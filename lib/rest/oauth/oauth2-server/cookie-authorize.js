var error = require('./error'),
  aes = require('aes-cross'),
  runner = require('./runner');

module.exports = CookieAuthorise;

/**
 * This is the function order used by the runner
 *
 * @type {Array}
 */
var fns = [
  decryptToken,
  checkToken
];

/**
 * CookieAuthorise
 *
 * @param {Object}   config Instance of OAuth object
 * @param {Object}   req
 * @param {Object}   res
 * @param {Function} next
 */
function CookieAuthorise (config, req, next) {
  this.config = config;
  this.model = config.model;
  this.req = req;

  runner(fns, this, next);
}

/**
 * Get bearer token
 *
 * Extract token from request according to RFC6750
 *
 * @param  {Function} done
 * @this   OAuth
 */

function decryptToken(done){
  var key = this.config.model.application.getCookiePrivateKey();
  encryptedToken = this.req.cookies['cookie-bearer'];
  tokens = aes.decText(encryptedToken, key);

  this.bearerToken = tokens.split('_')[0];
  this.refreshToken = tokens.split('_')[1];

  done();
}

/**
 * Check token
 *
 * Check it against model, ensure it's not expired
 * @param  {Function} done
 * @this   OAuth
 */
function checkToken (done) {
  var self = this;
  this.model.getAccessToken(this.bearerToken, function (err, token) {
    if (err) return done(error('serverError', false, err));

    if (!token) {
      return done(error('invalidToken',
        'The access token provided is invalid.'));
    }

    if (token.expires !== null &&
      (!token.expires || token.expires < new Date())) {
      return done(error('invalidToken',
        'The access token provided has expired.'));
    }
    // Expose params
    self.req.oauth = { bearerToken: token };
    self.req.user = token.user ? token.user : { id: token.userId };

    done();
  });
}
