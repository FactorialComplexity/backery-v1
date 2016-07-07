var request = require('request');
var errors = require('../../utils/errors.js');
var Twitter = require('twitter');


var TwitterTokenChecker = function(apiKey, apiSecret) {
    console.log('apiKey, apiSecret',apiKey, apiSecret);
    var self = this;
    self.apiKey = apiKey;
    self.apiSecret = apiSecret;
    
    self._getAppAccessToken = function(callback) {
        var self = this;
    
        var graph_url = 'https://graph.facebook.com/oauth/access_token?' +
            'client_id=' + facebookAppId +
            '&client_secret=' + facebookAppSecret +
            '&grant_type=client_credentials';
    
        request({
            uri: graph_url,
            method: "GET"
        }, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                var access_token = response.body.split('=')[1];
                callback(undefined, access_token);
            } else {
                callback(error);
            }
        });
    }
}

TwitterTokenChecker.prototype.checkAccessToken = function(token, secret, callback) {
    console.log('checkAccessToken token, secret', token, secret);
    var self = this;
    
    var client = new Twitter({
      consumer_key: self.apiKey,
      consumer_secret: self.apiSecret,
      access_token_key: token,
      access_token_secret: secret
    });
    
    console.log(client);
    
    // self._getAppAccessToken(function(error, app_token) {
    //     //console.log('Checking token: ', token);
    //     
    //     var graph_url = 'https://graph.facebook.com/debug_token?' +
    //         'input_token=' + token +
    //         '&access_token=' + app_token;
    //     
    //     request({
    //         uri: graph_url,
    //         method: "GET"
    //     }, function (error, response, body) {
    //         var body = JSON.parse(response.body);
    //         //console.log(error, body);
    //         
    //         if (!error && response.statusCode == 200) {
    //             //console.log('Token is valid');
    //             callback(undefined, body.data.user_id);
    //         } else {
    //             if (!error && body.error) {
    //                 console.log('ERROR: (Facebook)' + body.error.message);
    //                 error = new errors.BackeryInvalidParametersError('Facebook access token is invalid');
    //             }
    //             callback(error);
    //         }
    //     });
    // });
}

module.exports = TwitterTokenChecker;
