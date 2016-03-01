var fs = require('fs');
var _ = require('underscore');
var path = require('path');

var FacebookTokenChecker = require('./utils/FacebookTokenChecker.js');
var TrustedExtensionsRunner = require('./extensions/TrustedExtensionsRunner.js');
var ExtensionResponse = require('./extensions/ExtensionResponse.js');


var Application = function(nconf, model, Backery) {
    var self = this;
    
    self.Backery = Backery;
    
    var _model = model;
    var _nconf = nconf;
    var _extensionsRunner = new TrustedExtensionsRunner(_nconf.get('paths:extension-code'), _model.getDefinition().getName(), Backery);
    
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
    var tokenChecker = new FacebookTokenChecker(nconf.get('facebook:app_id'),
        nconf.get('facebook:app_secret'));
        
    self.validateFacebookToken = function(facebookAccessToken) {
        return new self.Backery.Promise(function(resolve, reject) {
            tokenChecker.checkAccessToken(facebookAccessToken, function(error, facebookUserId) {
                if (!error) {
                    resolve(facebookUserId);
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
                if (_extensionsRunner.hasHook(request)) {
                    return new self.Backery.Promise(function(resolve, reject) {
                        _extensionsRunner.processRequest(request, new ExtensionResponse(resolve, reject));
                    });
                } else {
                    return request.execute();
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
