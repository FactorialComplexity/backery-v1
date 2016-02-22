var FacebookTokenChecker = require('./utils/FacebookTokenChecker.js');

var Application = function(nconf, model, Backery) {
    var self = this;
    
    self.Backery = Backery;
    
    var _model = model;
    var _nconf = nconf;
    
    function loadExtensionCode() {
        var dir = _nconf.get('paths:extension-code');
        
    }
    
    self.getModelDefinition = function() {
        return _model.getDefinition();
    }
    
    self.getModel = function() {
        return _model;
    }
    
    self.getName = function() {
        // TODO
        return '';
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
}

Application.prototype.processRequest = function(request) {
    var self = this;
    if (request.getValidationError()) {
        return self.Backery.Promise.reject(request.getValidationError());
    } else {
        return request.execute().then(function(response) {
            return self.Backery.Promise.resolve(response.getResponseObject());
        });
    }
}

module.exports = Application;
