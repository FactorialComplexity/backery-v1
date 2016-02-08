var Application = function(nconf, model, Backer) {
    var self = this;
    
    self.Backer = Backer;
    
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
        return self.Backer.Promise.reject(request.getValidationError());
    } else {
        return request.execute().then(function(response) {
            return self.Backer.Promise.resolve(response.getResponseObject());
        });
    }
}

module.exports = Application;
