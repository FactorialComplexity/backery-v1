var request = require('request');

var GoogleTokenChecker = function(clientId) {
    var self = this;
    self.clientId = clientId;
}

GoogleTokenChecker.prototype.checkAccessToken = function(idToken, callback) {
    var self = this;
    request.get({
        url: 'https://www.googleapis.com/oauth2/v3/tokeninfo',
        qs: {
            id_token: idToken
        },
        json: true
    }, function(error, res, body) {
        if (error) {
            callback(error);
        } else {
            if (body.error_description) {
                return callback(new Error(body.error_description));
            }
            
            if (body.aud != self.clientId) {
                return callback(new Error('Invalid client id'));
            }
            
            callback(undefined, body.sub);
        }
    });
}

module.exports = GoogleTokenChecker;
