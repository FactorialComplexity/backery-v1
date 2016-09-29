var request = require('request');

var GoogleTokenChecker = function(clientIds) {
    var self = this;
    self.clientIds = clientIds;
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
            
            var isMatchToOneOfClientIds = false;
            self.clientIds.forEach(function(item) {
                if (body.aud == item ) {
                    isMatchToOneOfClientIds = true;
                }
            });
            
            if (!isMatchToOneOfClientIds) {
                return callback(new Error('Invalid client id'));
            }
            
            callback(undefined, body.sub);
        }
    });
}

module.exports = GoogleTokenChecker;
