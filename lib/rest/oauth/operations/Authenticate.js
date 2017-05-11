var errors = require('../../../utils/errors.js');

module.exports = function grant(auth, config, Backery) {
    var Authenticate = function(req, res) {
        var self = this;
        
        this.process = function() {
            if (req.header('Authorization') && req.header('Authorization').indexOf('Bearer') == 0) {
                return this.processBearer();
            } else if (req.signedCookies.backeryAuth) {
                return this.processCookie();
            } else {
                return Backery.Promise.reject(new errors.BackeryBadRequestError('Unknown authentication method'));
            }
        }
        
        this.processCookie = function() {
            return auth.decryptTokens(req.signedCookies.backeryAuth).then(function(authData) {
                return Backery.Promise.all([
                    authData,
                    auth.getAccessToken(authData.accessToken)
                ]);
            }).spread(function(authData, accessToken) {
                if (!accessToken) {
                    return auth.getRefreshToken(authData.refreshToken).then(function(refreshToken) {
                        if (!refreshToken || refreshToken.clientId !== authData.clientId) {
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
                            return auth.createAccessToken(authData.clientId, refreshToken.user).then(function(accessToken) {
                                // Expose params
                                req.oauth = { cookieToken: authData.accessToken };
                                req.clientId = accessToken.clientId;
                                req.user = accessToken.user;
                                
                                return auth.encryptTokens(accessToken.token, refreshToken.token, accessToken.clientId)
                                    .then(function(encryptedTokens)
                                {
                                    res.cookie('backeryAuth', encryptedTokens, { signed: true });
                                    return Backery.Promise.resolve(accessToken.user);
                                });
                            });
                        });
                    });
                    
                    
                } else {
                    if (accessToken.user && accessToken.user.get('blocked')) {
                        return Backery.Promise.reject(new errors.BackeryUnauthorizedError('User is blocked', 'UserIsBlocked'));
                    }
                    
                    // Expose params
                    req.oauth = { cookieToken: authData.accessToken };
                    req.clientId = accessToken.clientId;
                    req.user = accessToken.user;
                
                    return Backery.Promise.resolve(accessToken.user);
                }
            });
        }
        
        this.processBearer = function() {
            // getBearerToken
            var headerToken = req.header('Authorization'),
                getToken =  req.query.access_token,
                postToken = req.body ? req.body.access_token : undefined;
            // Check exactly one method was used
            var methodsUsed = (headerToken !== undefined) + (getToken !== undefined) +
                (postToken !== undefined);

            if (methodsUsed > 1) {
                return Backery.Promise.reject(new errors.BackeryBadRequestError(
                    'Only one method may be used to authenticate at a time (Auth header, GET or POST'));
            } else if (methodsUsed === 0) { // no access token found
                return Backery.Promise.resolve();
            }

            // Header: http://tools.ietf.org/html/rfc6750#section-2.1
            if (headerToken) {
                var matches = headerToken.match(/Bearer\s(\S+)/);

                if (!matches) {
                    return Backery.Promise.reject(new errors.BackeryBadRequestError('Malformed auth header'));
                }
                
                headerToken = matches[1];
            }

            // POST: http://tools.ietf.org/html/rfc6750#section-2.2
            if (postToken) {
                if (req.method === 'GET') {
                    return Backery.Promise.reject(new errors.BackeryBadRequestError(
                        'Method cannot be GET When putting the token in the body'));
                }

                if (!req.is('application/x-www-form-urlencoded')) {
                    return Backery.Promise.reject(new errors.BackeryBadRequestError(
                        'When putting the token in the body, content type must be application/x-www-form-urlencoded.'));
                }
            }

            var bearerToken = headerToken || postToken || getToken;
            
            return auth.getAccessToken(bearerToken).then(function(token) {
                if (!token) {
                    return Backery.Promise.reject(new errors.BackeryUnauthorizedError('The access token provided is invalid',
                        'TokenExpiredError'));
                }
                
                if (token.expires !== null && (!token.expires || token.expires < new Date())) {
                    return Backery.Promise.reject(new errors.BackeryUnauthorizedError('The access token provided has expired',
                        'TokenExpiredError'));
                }

                if (token.user && token.user.get('blocked')) {
                    return Backery.Promise.reject(new errors.BackeryUnauthorizedError('User is blocked', 'UserIsBlocked'));
                }

                // Expose params
                req.oauth = { bearerToken: token };
                req.clientId = token.clientId;
                req.user = token.user;
                
                return Backery.Promise.resolve(token.user);
            });
        }
    }
        
    return Authenticate;
}
