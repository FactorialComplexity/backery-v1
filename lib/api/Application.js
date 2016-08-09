var fs = require('fs');
var _ = require('underscore');
var path = require('path');

var SMTPMailer = require('../mailer/SMTPMailer.js');
var errors = require('../utils/errors.js');

var FacebookTokenChecker = require('./utils/FacebookTokenChecker.js');
var TwitterTokenChecker = require('./utils/TwitterTokenChecker.js');
var GoogleTokenChecker = require('./utils/GoogleTokenChecker.js');
var TrustedExtensionsRunner = require('./extensions/TrustedExtensionsRunner.js');
var ExtensionResponse = require('./extensions/ExtensionResponse.js');


var Application = function(nconf, model, Backery) {
    var self = this;
    
    self.Backery = Backery;
    
    var _model = model;
    var _nconf = nconf;
    var _extensionsRunner = new TrustedExtensionsRunner(_nconf.get('paths:extension-code'),
        _model.getDefinition().getName(), nconf.get('custom'), Backery);
    
    function databaseHook(entityDefinition, type) {
        return function(object, arg1) {
            var hook = _extensionsRunner.getDatabaseHook(entityDefinition.name, type);
            if (hook) {
                var ret = hook(object, arg1);
                return _.isUndefined(ret) ? Backery.Promise.resolve(object) :
                    ret.then(Backery.Promise.resolve(object));
            } else {
                return Backery.Promise.resolve(object);
            }
        }
    }
    
    _model.setDatabaseHooksProvider({
        getDatabaseHooks: function(entityDefinition) {
            return {
                afterFetch: databaseHook(entityDefinition, 'afterFetch'),
                
                beforeSave: databaseHook(entityDefinition, 'beforeSave'),
                afterSave: databaseHook(entityDefinition, 'afterSave'),
                
                beforeDestroy: databaseHook(entityDefinition, 'beforeDestroy'),
                afterDestroy: databaseHook(entityDefinition, 'afterDestroy')
            };
        }
    });
    
    self.getModelDefinition = function() {
        return _model.getDefinition();
    }
    
    self.getModel = function() {
        return _model;
    }
    
    self.getName = function() {
        return _model.getDefinition().getName();
    }
    
    self.getCustomEndpointsList = function() {
        return _extensionsRunner.getCustomEndpointsList();
    }
    
    self.getRequestHooks = function() {
        return _extensionsRunner.getRequestHooks();
    }
    
    self.getDatabaseHooks = function() {
        return _extensionsRunner.getDatabaseHooks();
    }

    self.getCookiePrivateKey = function() {
        return _nconf.get('oauth2:cookie_private_key');
    }
    
    self.hasOAuth2Client = function(clientId, clientSecret) {
        var secret = _nconf.get('oauth2:clients:' + clientId);
        if (clientSecret === null) {
            return !!secret;
        } else {
            return clientSecret == secret;
        }
    }
    
    // Facebook
    var facebookTokenChecker = new FacebookTokenChecker(nconf.get('facebook:app_id'),
        nconf.get('facebook:app_secret'));
        
    self.validateFacebookToken = function(facebookAccessToken) {
        return new self.Backery.Promise(function(resolve, reject) {
            facebookTokenChecker.checkAccessToken(facebookAccessToken, function(error, facebookUserId) {
                if (!error) {
                    resolve(facebookUserId);
                } else {
                    reject(error);
                }
            });
        });
    }
    
    // Twitter
    var twitterTokenChecker = new TwitterTokenChecker(nconf.get('twitter:api_key'),
        nconf.get('twitter:api_secret'));
        
    self.validateTwitterToken = function(twitterAccessToken, twitterAccessSecret) {
        return new self.Backery.Promise(function(resolve, reject) {
            twitterTokenChecker.checkAccessToken(twitterAccessToken, twitterAccessSecret, function(error, twitterUserId) {
                if (!error) {
                    resolve(twitterUserId);
                } else {
                    reject(error);
                }
            });
        });
    }
    
    // Google
    var googleTokenChecker = new GoogleTokenChecker(nconf.get('google:client_id'),
        nconf.get('google:client_secret'));
        
    self.validateGoogleToken = function(googleAccessToken) {
        return new self.Backery.Promise(function(resolve, reject) {
            googleTokenChecker.checkAccessToken(googleAccessToken, function(error, googleUserId) {
                if (!error) {
                    resolve(googleUserId);
                } else {
                    reject(error);
                }
            });
        });
    }
    
    self.processRequest = function(request) {
        if (request.getValidationError()) {
            return self.Backery.Promise.reject(request.getValidationError());
        } else {
            if (request.type != 'CustomEndpoint') {
                if (_extensionsRunner.hasRequestHook(request)) {
                    return new self.Backery.Promise(function(resolve, reject) {
                        _extensionsRunner.processRequest(request, new ExtensionResponse(resolve, reject));
                    });
                } else {
                    return request.prepare().then(function(request) {
                        return request.execute();
                    });
                }
            } else {
                // Custom endpoints are always processed by extensions code
                return new self.Backery.Promise(function(resolve, reject) {
                    _extensionsRunner.processEndpoint(request.method, request.endpoint,
                        request, new ExtensionResponse(resolve, reject));
                });
            }
        }
    }
    
    // Mailer
    if (_nconf.get('mailer:type')) {
        var mailerType = _nconf.get('mailer:type');
        var _mailer;
        
        if (mailerType == 'smtp') {
            _mailer = new SMTPMailer(_nconf.get('mailer:config'), Backery);
        }
        
        Object.defineProperty(this, 'mailer', { get: function() { return _mailer; } });
    }
    
    // Recover password
    function _getEmailAuthField() {
        var passwordAuthMethod = _.find(self.getModelDefinition().authMethods, function(authMethod) {
            return authMethod.isPassword();
        });
        
        if (!passwordAuthMethod)
            return;
        
        return passwordAuthMethod.passwordRecoveryEmailField;
    }
    
    self.isPasswordRecoveryEmailSupported = function() {
        return !!_getEmailAuthField();
    }
    
    self.sendPasswordRecoveryEmail = function(email) {
        var User = _model.entity('User');
        var emailField = _getEmailAuthField();
        
        if (!emailField) {
            return Backery.Promise.reject(new errors.BackeryConsistencyError('Password cannot be recovered via email, ' +
                'because email field login field is not specified'));
        }
        
        console.log('PWD RECOVERY (' + email + ')');
        
        return User.query().where(emailField.name, email).findOne().then(function(user) {
            if (user) {
                return user.resetPasswordRecoveryToken();
            } else {
                return Backery.Promise.reject(new errors.BackeryNotFoundError('User with email ' + email + ' is not registered'));
            }
        }).then(function(token) {
            var recoverText =
                'Hello\n\n' +
                'Someone, hopefully you, has requested that your password for ' + self.getName() + ' be reset.\n' +
                'Please copy the following url into your browser to complete the password reset process.\n\n' +
                'http' + (nconf.get('http:publicHost:ssl') ? 's' : '') + '://' + nconf.get('http:publicHost:name') +
                    (nconf.get('http:publicHost:port') ? ':' + nconf.get('http:publicHost:port') : '') + '/web/reset-password/?token=' + token + '\n\n'
                'Thank you';
            
            return self.mailer.sendMail({
                from: _nconf.get('mailer:from'),
                to: email,
                subject: self.getName() + ': Reset Password',
                text: recoverText
            }).then(function(response) {
                console.log('PWD RECOVERY (' + email + ') ' + response)
            }).catch(function(error) {
                console.log('PWD RECOVERY (' + email + ') ERROR ', error)
            });
        });
    }
    
    self.resetPassword = function(token, password) {
        return _model.findUserWithPasswordRecoveryToken(token).then(function(user) {
            if (user && user.isPasswordRecoveryTokenValid(token)) {
                user.set('password', password);
                return user.save();
            } else {
                return Backery.Promise.reject(new errors.BackeryNotFoundError('Invalid token specified'));
            }
        });
    }
}

module.exports = Application;
