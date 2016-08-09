var request = require('request');
var google = require('googleapis');

var GoogleTokenChecker = function(apiKey, apiSecret) {
    var self = this;
    self.apiKey = apiKey;
    self.apiSecret = apiSecret;
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
            callback(undefined, body.sub);
        }
    });
    
    // var plus = google.plus('v1');
    // var OAuth2 = google.auth.OAuth2;
    // var oauth2Client = new OAuth2(self.apiKey, self.apiSecret); //redirect_url
    //
    // oauth2Client.setCredentials({
    //     access_token: access_token,
    //     refresh_token: refresh_token
    // });
    //
    // plus.people.get({ userId: 'me', auth: oauth2Client }, function(err, response) {
    //     if (err) {
    //         console.log('ERROR: (Google)' + err);
    //         error = new errors.BackeryInvalidParametersError('Google access tokens are invalid');
    //         callback(error);
    //     } else {
    //         callback(undefined, response);
    //     }
    // });
    
}

module.exports = GoogleTokenChecker;
