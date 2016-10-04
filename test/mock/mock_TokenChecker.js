var errors = require('../../lib/utils/errors.js');

var FacebookTokenChecker = function() {
    this.checkAccessToken = function(token, callback) {
        if (token == 'validFacebookTokenForExistingUser') {
            callback(undefined, 'existingUserId_facebook');
        } else if (token == 'validFacebookTokenForNotExistingUser') {
            callback(undefined, 'notExistingUserId_facebook');
        } else {
            callback(new errors.BackeryInvalidParametersError('Facebook access token is invalid'));
        }
    }
}

var TwitterTokenChecker = function() {
    this.checkAccessToken = function(token, secret, callback) {
        if (token == 'validTwitterTokenForExistingUser' && secret == 'validTwitterTokenSecret') {
            callback(undefined, 'existingUserId_twitter');
        } else if (token == 'validTwitterTokenForNotExistingUser') {
            callback(undefined, 'notExistingUserId_twitter' && secret == 'validTwitterTokenSecret');
        } else {
            callback(new errors.BackeryInvalidParametersError('Twitter access token is invalid'));
        }
    }
}

var GoogleTokenChecker = function() {
    this.checkAccessToken = function(token, callback) {
        if (token == 'validGoogleTokenForExistingUser') {
            callback(undefined, 'existingUserId_google');
        } else if (token == 'validGoogleTokenForNotExistingUser') {
            callback(undefined, 'notExistingUserId_google');
        } else {
            callback(new errors.BackeryInvalidParametersError('Google access token is invalid'));
        }
    }
}

module.exports = {
    '../utils/integrations/FacebookTokenChecker.js': FacebookTokenChecker,
    '../utils/integrations/TwitterTokenChecker.js': TwitterTokenChecker,
    '../utils/integrations/GoogleTokenChecker.js': GoogleTokenChecker
};
