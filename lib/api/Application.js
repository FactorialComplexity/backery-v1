var Application = function(nconf, model, Backery) {
    var self = this;
    
    self.Backery = Backery;
    
    var _model = model;
    var _nconf = nconf;
    
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
