var error = require('./oauth2-server/error');
var Grant = require('./oauth2-server/grant');
var OAuthModel = require('./OAuthModel.js');

var OAuth = function(application) {
    var _application = application;
    var _grants = ['password','refresh_token'];
    var _config = {
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 1209600,
        authCodeLifetime: 30,

        regex: {
          clientId: /^[a-z0-9-_]{3,40}$/i,
          grantType: new RegExp('^(' + _grants.join('|') + ')$', 'i')
        },
        
        model: new OAuthModel(application)
    };
    
    var self = this;
    
    this.auth = function() {
        return function(req, res, next) {
            new Grant(_config, req, res, next);
        }
    }
    
    this.authenticate = function(req, res, next) {
        
    }
}

module.exports = OAuth;
