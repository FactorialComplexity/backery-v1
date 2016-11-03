var crypto = require('crypto');
var _ = require('lodash');

var errors = require('../utils/errors.js');

var FacebookTokenChecker = require('../utils/integrations/FacebookTokenChecker.js');
var TwitterTokenChecker = require('../utils/integrations/TwitterTokenChecker.js');
var GoogleTokenChecker = require('../utils/integrations/GoogleTokenChecker.js');

var AuthMethodDefinition = require('../model/definition/AuthMethodDefinition.js');

var MemoryStorage = require('./storages/MemoryStorage.js');


var Authentication = function(application, nconf) {
    var self = this;
    
    var database = application.getModel();
    var schema = database.getDefinition();
    var Backery = self.Backery = application.Backery;
    
    var accessTokensStorage = new MemoryStorage({ }, Backery);
    var clients = nconf.get('oauth2:clients');
    _.each(clients, function(client, clientId) {
        clients[clientId] = _.isString(client) ?
            { secret: client } : client;
    })
    
    function _generateRandomToken() {
        return new Backery.Promise(function(resolve, reject) {
            crypto.randomBytes(256, function(ex, buffer) {
                if (ex)
                    reject(new Error('Failed to generate a random token'));
                else
                    resolve(crypto.createHash('sha1').update(buffer).digest('hex'));
            });
        });
    };
    
    this.hasOAuth2Client = function(clientId, clientSecret) {
        var secret = clients[clientId] ? clients[clientId].secret : undefined;
        if (!secret) {
            return false;
        }
        
        if (clientSecret === null) {
            return !!secret;
        } else {
            return clientSecret === secret;
        }
    }
    
    this.getAccessToken = function(accessToken) {
        if (/^master\:/.test(accessToken)) {
            var parts = accessToken.split(':');
            if (parts.length === 4) {
                var userId = parts[1];
                var clientId = parts[2];
                var tokenValue = parts[3];
                
                if (nconf.get('oauth2:masterAccessTokens').indexOf(tokenValue) != -1) {
                    return Backery.Model.User.get(userId).then(function(user) {
                        if (!user) {
                            return Backery.Promise.reject(new errors.BackeryUnauthorizedError('User not found (id: ' + userId + ')'));
                        }
                        
                        var tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        
                        return Backery.Promise.resolve({
                            token: accessToken,
                            expires: tomorrow,
                            clientId: clientId,
                            user: user
                        });
                    });
                } else {
                    return Backery.Promise.reject(new errors.BackeryUnauthorizedError('Master accessToken is not valid'));
                }
                
            } else {
                return Backery.Promise.reject(new errors.BackeryUnauthorizedError('Invalid master accessToken format (expected: \"master:userId:clientId:secret\")'));
            }
        }
        
        return accessTokensStorage.fetchAccessToken(accessToken);
    }
    
    this.allowsClientIdForUser = function(clientId, user) {
        var clients = nconf.get('oauth2:clients');
        var client = clients[clientId];
        if (client.roles !== undefined) {
            return !!_.find(client.roles, function(role) {
                return user.hasRole(role);
            });
        }
        
        return true;
    }
    
    this.createAccessToken = function(clientId, user) {
        return _generateRandomToken().then(function(accessToken) {
            var expires = new Date();
            expires.setSeconds(expires.getSeconds() + nconf.get('oauth2:tokensLifetime:accessToken'));
            
            return accessTokensStorage.storeAccessToken(accessToken, clientId, expires, user).then(function() {
                return Backery.Promise.resolve({
                    token: accessToken,
                    expiresIn: nconf.get('oauth2:tokensLifetime:accessToken')
                });
            });
        });
    }
    
    this.getRefreshToken = function(refreshToken) {
        return database.getRefreshToken(refreshToken).then(function(refreshToken) {
            if (refreshToken) {
                var updateRefreshToken = refreshToken.update;
                delete refreshToken.update;
                refreshToken.extendLifetime = function() {
                    var expires = new Date();
                    expires.setSeconds(expires.getSeconds() + nconf.get('oauth2:tokensLifetime:refreshToken'));
                    
                    return _generateRandomToken().then(function(token) {
                        return updateRefreshToken(expires, token);
                    });
                }
            }
            
            return Backery.Promise.resolve(refreshToken);
        });
    }
    
    this.createRefreshToken = function(clientId, user) {
        return _generateRandomToken().then(function(token) {
            var expires = new Date();
            expires.setSeconds(expires.getSeconds() + nconf.get('oauth2:tokensLifetime:refreshToken'));
            
            return database.saveRefreshToken(token, clientId, expires, user).then(function() {
                return Backery.Promise.resolve(token);
            });
        });
    }
    
    // Facebook
    var facebookTokenChecker = new FacebookTokenChecker(nconf.get('facebook:app_id'),
        nconf.get('facebook:app_secret'));
    function validateFacebookToken(facebookAccessToken) {
        return new self.Backery.Promise(function(resolve, reject) {
            facebookTokenChecker.checkAccessToken(facebookAccessToken, function(error, facebookUserId) {
                if (!error) {
                    resolve(facebookUserId);
                } else {
                    reject(new errors.BackeryUnauthorizedError('Invalid facebook_access_token'));
                }
            });
        });
    }

    // Twitter
    var twitterTokenChecker = new TwitterTokenChecker(nconf.get('twitter:api_key'),
        nconf.get('twitter:api_secret'));
    function validateTwitterToken(twitterAccessToken, twitterAccessSecret) {
        return new self.Backery.Promise(function(resolve, reject) {
            twitterTokenChecker.checkAccessToken(twitterAccessToken, twitterAccessSecret, function(error, twitterUserId) {
                if (!error) {
                    resolve(twitterUserId);
                } else {
                    reject(new errors.BackeryUnauthorizedError('Invalid twitter_access_token or twitter_access_token_secret'));
                }
            });
        });
    }

    // Google
    var googleTokenChecker = new GoogleTokenChecker(nconf.get('google:clientIds'));
    function validateGoogleToken(googleAccessToken) {
        return new self.Backery.Promise(function(resolve, reject) {
            googleTokenChecker.checkAccessToken(googleAccessToken, function(error, googleUserId) {
                if (!error) {
                    resolve(googleUserId);
                } else {
                    reject(new errors.BackeryUnauthorizedError('Invalid google_id_token'));
                }
            });
        });
    }
    
    function getExistingThirdPartyServiceUser(method, params) {
        var validator;
        if (method == 'facebook') {
            validator = validateFacebookToken(params.facebook_access_token);
        } else if (method == 'twitter') {
            validator = validateTwitterToken(params.twitter_access_token, params.twitter_access_token_secret);
        } else if (method == 'google') {
            validator = validateGoogleToken(params.google_id_token);
        }
        
        return validator.then(function(userId) {
            return Backery.Promise.all([
                database.findUserWithThirdPartyServiceUserId(method, userId),
                userId
            ]);
        });
    }
    
    this.authenticateUser = function(method, params, clientId) {
        var methodDefinition = _.find(schema.authMethods, function(authMethod) {
            if (method == 'password' && authMethod.method == AuthMethodDefinition.Password) {
                return authMethod;
            } else if (method == 'facebook' && authMethod.method == AuthMethodDefinition.Facebook) {
                return authMethod;
            } else if (method == 'twitter' && authMethod.method == AuthMethodDefinition.Twitter) {
                return authMethod;
            } else if (method == 'google' && authMethod.method == AuthMethodDefinition.Google) {
                return authMethod;
            }
        });
        
        if (!methodDefinition) {
            return Backery.Promise.reject(new errors.BackeryConsistencyError('Authentication method \"' +
                method + '\" is not supported'));
        }
        
        if (method == 'password') {
            var usernameString = params.username;
            var loginField = methodDefinition.loginFields[0];
            var login = usernameString;
        
            if (usernameString.indexOf(':') != -1) {
                var fieldName = usernameString.substring(0, usernameString.indexOf(':'));
            
                loginField = _.find(methodDefinition.loginFields, function(field) {
                    return field.name == fieldName;
                });
            
                if (!loginField) {
                    return Backery.Promise.reject(new errors.BackeryConsistencyError('Invalid login field: "' + fieldName + '"'));
                }
            
                login = usernameString.substring(usernameString.indexOf(':')+1);
            }
            
            return Backery.Model.User.query().where(loginField.name, login).findOne().then(function(user) {
                if (user && user.isPasswordCorrect(params.password)) {
                    if (user.get('blocked')) {
                        return Backery.Promise.reject(new errors.BackeryUnauthorizedError('User is blocked',
                            'UserIsBlocked'));
                    } else {
                        return Backery.Promise.resolve(user);
                    }
                } else {
                    return Backery.Promise.reject(new errors.BackeryUnauthorizedError('User credentials are invalid',
                        'InvalidCredentialsError'));
                }
            });
        } else {
            return getExistingThirdPartyServiceUser(method, params).spread(function(user, thirdPartyUserId) {
                if (user) {
                    return Backery.Promise.resolve(user);
                } else {
                    var createRequest = new application.Request.CreateOrUpdate(Backery.Model.User, undefined, {},
                        undefined, undefined, undefined, Backery,
                        function(createdUser) {
                            if (method == 'facebook') {
                                createdUser.setFacebookUserId(thirdPartyUserId);
                            } else if (method == 'twitter') {
                                createdUser.setTwitterUserId(thirdPartyUserId);
                            } else if (method == 'google') {
                                createdUser.setGoogleUserId(thirdPartyUserId);
                            }
                        });
                    
                    return application.processRequest(createRequest, { clientId: clientId }).then(function() {
                        return Backery.Promise.resolve(createRequest.object);
                    });
                }
            });
        }
    }
    
    this.isAuthenticationMethodSupported = function(methodName) {
        return !!_.find(schema.authMethods, function(authMethod) {
            return authMethod.name == methodName;
        });
    }
}

module.exports = Authentication;
