var fs = require('fs');
var _ = require('underscore');
var path = require('path');

var FacebookTokenChecker = require('./utils/FacebookTokenChecker.js');
var TwitterTokenChecker = require('./utils/TwitterTokenChecker.js');
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
                beforeSave: databaseHook(entityDefinition, 'beforeSave'),
                afterSave: databaseHook(entityDefinition, 'afterSave'),
                beforeDestroy: databaseHook(entityDefinition, 'beforeDestroy'),
                afterDestroy: databaseHook(entityDefinition, 'afterDestroy'),
                afterStruct: databaseHook(entityDefinition, 'afterStruct')
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
}

module.exports = Application;
