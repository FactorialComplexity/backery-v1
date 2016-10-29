var errors = require('../../../utils/errors.js');
var basicAuth = require('../utils/basic-auth.js');

function Client (id, secret) {
    this.clientId = id;
    this.clientSecret = secret;
}

function credsFromBasic(req) {
    var user = basicAuth(req);

    if (!user)
        return false;

    return new Client(user.name, user.pass);
}

function credsFromBody(req) {
    return new Client(req.body.client_id, req.body.client_secret);
}

module.exports = function grant(auth, config, Backery) {
    var Grant = function(req, res) {
        var self = this;
        
        this.process = function(user) {
            return self.validateClient(!!user).then(function() {
                // authenticateUser
                if (!user) {
                    return self.authenticateUser();
                } else {
                    return Backery.Promise.resolve(user);
                }
            }).then(function(user) {
                // exposeUser
                self.user = req.user = user;
                
                // generateAccessToken
                return auth.createAccessToken(self.client.clientId, self.user);
            }).then(function(accessToken) {
                self.accessToken = accessToken;
                
                // generateRefreshToken
                if (!self.refreshToken) {
                    return auth.createRefreshToken(self.client.clientId, self.user).then(function(refreshToken) {
                        self.refreshToken = refreshToken;
                    });
                } else {
                    return Backery.Promise.resolve();
                }
            }).then(function() {
                // sendResponse
                var responseData = {
                    token_type: 'bearer',
                    access_token: self.accessToken.token,
                    expires_in: self.accessToken.expiresIn,
                    refresh_token: self.refreshToken || undefined,
                    user: self.user.toJSON({ verbose: req.backeryShouldRespondVerbose })
                    // user: self.grantType != 'refresh_token' ? self.user.toJSON({ verbose: req.backeryShouldRespondVerbose }) :
                    //     undefined
                };
                
                return Backery.Promise.resolve(responseData);
            });
        }
        
        this.validateClient = function(ignoreMethodAndContentType) {
            // extractCredentials
            if ((req.method !== 'POST' || !req.is('application/x-www-form-urlencoded')) && !ignoreMethodAndContentType) {
                return Backery.Promise.reject(new errors.BackeryBadRequestError(
                    'Method must be POST with application/x-www-form-urlencoded encoding'));
            }
        
            // Extract credentials
            // http://tools.ietf.org/html/rfc6749#section-3.2.1
            self.client = credsFromBasic(req) || credsFromBody(req);

            if (!self.client.clientId || !self.client.clientId.match(config.regex.clientId)) {
                res.set('WWW-Authenticate', 'Basic realm="Service"');
                return Backery.Promise.reject(new errors.BackeryUnauthorizedError('Invalid or missing client_id parameter'));
            } else if (!self.client.clientSecret) {
                res.set('WWW-Authenticate', 'Basic realm="Service"');
                return Backery.Promise.reject(new errors.BackeryUnauthorizedError('Missing client_secret parameter'));
            }
        
            // checkClient
            if (!auth.hasOAuth2Client(self.client.clientId, self.client.clientSecret)) {
                res.set('WWW-Authenticate', 'Basic realm="Service"');
                return Backery.Promise.reject(new errors.BackeryUnauthorizedError('Client credentials are invalid'));
            }
  
            // Expose validated client
            req.oauth = {
                client: self.client
            };
            
            return Backery.Promise.resolve(self.client);
        }
        
        this.usePasswordGrant = function() {
            var credentials = {
                username: req.body.username,
                password: req.body.password
            };
            
            if (!credentials.username || !credentials.username) {
                return Backery.Promise.reject(new errors.BackeryInvalidParametersError(
                    'Missing parameters. "username" and "password" are required'));
            }

            return auth.authenticateUser('password', credentials).then(function(user) {
                if (!user) {
                    return Backery.Promise.reject(new errors.BackeryUnauthorizedError(message,
                        'InvalidCredentialsError'));
                }
                
                return Backery.Promise.resolve(user);
            });
        }
        
        this.useRefreshTokenGrant = function() {
            var token = req.body.refresh_token;
            if (!token) {
                return Backery.Promise.reject(new errors.BackeryInvalidParametersError('No "refresh_token" parameter'));
            }

            return auth.getRefreshToken(token).then(function(refreshToken) {
                if (!refreshToken || refreshToken.clientId !== self.client.clientId) {
                    return Backery.Promise.reject(new errors.BackeryUnauthorizedError('Invalid refresh token',
                        'InvalidTokenError'));
                }
                
                if (refreshToken.expires !== null && (refreshToken.expires < new Date())) {
                    return Backery.Promise.reject(new errors.BackeryUnauthorizedError('Refresh token has expired',
                        'TokenExpiredError'));
                }

                if (!refreshToken.user) {
                    return Backery.Promise.reject(new errors.BackeryUnauthorizedError('User with this token was deleted',
                        'InvalidTokenError'));
                }
                
                return refreshToken.extendLifetime().then(function() {
                    self.refreshToken = refreshToken.token;
                    return Backery.Promise.resolve(refreshToken.user);
                });
            });
        }
        
        this.useExtendedGrant = function() {
            return config.extendedGrantHandlers[self.grantType](req);
        }
        
        this.authenticateUser = function() {
            // Grant type
            self.grantType = req.body && req.body.grant_type;
            
            if (!self.grantType || config.grants.indexOf(self.grantType) == -1) {
                return Backery.Promise.reject(new errors.BackeryInvalidParametersError('Invalid or missing grant_type parameter'));
            }
            
            // checkGrantTypeAllowed (for a specific clientId)
            // Always allow
            
            if (self.grantType.match(/^[a-zA-Z][a-zA-Z0-9+.-]+:/)) {
                return self.useExtendedGrant();
            }
            
            switch (self.grantType) {
                case 'password': return self.usePasswordGrant();
                case 'refresh_token': return self.useRefreshTokenGrant();
            }
            
            return Backery.Promise.reject(new errors.BackeryBadRequestError('Invalid grant_type parameter or parameter missing'));
        }
    }
    
    return Grant;
}
