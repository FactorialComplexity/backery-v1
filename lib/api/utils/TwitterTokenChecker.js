var request = require('request');
var errors = require('../../utils/errors.js');
var Twitter = require('twitter');


var TwitterTokenChecker = function(apiKey, apiSecret) {
    var self = this;
    self.apiKey = apiKey;
    self.apiSecret = apiSecret;
}

TwitterTokenChecker.prototype.checkAccessToken = function(token, secret, callback) {
    var self = this;
    
    var client = new Twitter({
      consumer_key: self.apiKey,
      consumer_secret: self.apiSecret,
      access_token_key: token,
      access_token_secret: secret
    });
    
    client.get('account/verify_credentials', {}, function(error, response, body){
      if (error) {
          console.log('ERROR: (Twitter)' + error[0].message);
          error = new errors.BackeryInvalidParametersError('Twitter access tokens are invalid');
          callback(error);
      } else {
          callback(undefined, response.id_str);
      }
    })
    
}

module.exports = TwitterTokenChecker;
