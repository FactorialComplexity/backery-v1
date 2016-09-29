var crypto = require('crypto');
var _ = require('lodash');

var requests = require('../requests.js');
var errors = require('../../utils/errors.js');

var FacebookTokenChecker = require('../utils/FacebookTokenChecker.js');
var TwitterTokenChecker = require('../utils/TwitterTokenChecker.js');
var GoogleTokenChecker = require('../utils/GoogleTokenChecker.js');

var AuthMethodDefinition = require('../../model/definition/AuthMethodDefinition.js');


var Authentication = function(application, nconf) {
    var self = this;
    
    var database = application.getModel();
    var schema = database.getDefinition();
    var Backery = self.Backery = application.Backery;
    
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
        var secret = nconf.get('oauth2:clients:' + clientId);
        if (clientSecret === null) {
            return !!secret;
        } else {
            return clientSecret == secret;
        }
    }
    
    this.getAccessToken = function(accessToken) {
        return database.getAccessToken(accessToken);
    }
    
    this.createAccessToken = function(clientId, user) {
        return _generateRandomToken().then(function(accessToken) {
            return database.saveAccessToken(accessToken, clientId,
                new Date(new Date() + nconf.get('oauth2:tokensLifetime:accessToken')), user)
            .then(function() {
                return Backery.Promise.resolve({
                    token: accessToken,
                    expiresIn: nconf.get('oauth2:tokensLifetime:accessToken')
                });
            });
        });
    }
    
    this.getRefreshToken = function(refreshToken) {
        return database.getRefreshToken(refreshToken).then(function(refreshToken) {
            var updateRefreshToken = refreshToken.update;
            delete refreshToken.update;
            refreshToken.extendLifetime = function() {
                return _generateRandomToken().then(function(token) {
                    return updateRefreshToken(nconf.get('oauth2:tokensLifetime:refreshToken'),
                        token);
                });
            }
            
            return Backery.Promise.resolve(refreshToken);
        });
    }
    
    this.createRefreshToken = function(clientId, user) {
        return _generateRandomToken().then(function(token) {
            return database.saveRefreshToken(token, clientId,
                new Date(new Date() + nconf.get('oauth2:tokensLifetime:accessToken')),
                user
            ).then(function() {
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
    
    this.authenticateUser = function(method, params) {
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
                    var createRequest = new requests.CreateOrUpdateRequest(Backery.Model.User, undefined, {},
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
                    
                    return application.processRequest(createRequest).then(function() {
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
