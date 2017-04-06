var request = require('request');
var errors = require('../../utils/errors.js');

var FacebookTokenChecker = function(facebookAppId, facebookAppSecret) {
    var self = this;
    self.facebookAppId = facebookAppId;
    self.facebookAppSecret = facebookAppSecret;
    
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
                var access_token = '';
                
                try {
                    var response_object = JSON.parse(response.body);
                    access_token = response_object['access_token'];
                } catch (e) {
                    access_token = response.body.split('=')[1];
                }
                
                callback(undefined, access_token);
            } else {
                callback(error);
            }
        });
    }
}

FacebookTokenChecker.prototype.checkAccessToken = function(token, callback) {
    var self = this;
    
    self._getAppAccessToken(function(error, app_token) {
        //console.log('Checking token: ', token);
        
        var graph_url = 'https://graph.facebook.com/debug_token?' +
            'input_token=' + token +
            '&access_token=' + app_token;
        
        request({
            uri: graph_url,
            method: "GET"
        }, function (error, response, body) {
            var body = JSON.parse(response.body);
            //console.log(error, body);
            
            if (!error && response.statusCode == 200) {
                //console.log('Token is valid');
                callback(undefined, body.data.user_id);
            } else {
                if (!error && body.error) {
                    //console.error('ERROR: (Facebook) ' + body.error.message);
                    error = new errors.BackeryInvalidParametersError('Facebook access token is invalid');
                }
                callback(error);
            }
        });
    });
}

module.exports = FacebookTokenChecker;
