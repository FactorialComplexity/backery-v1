var _ = require('underscore');

var OAuth = function(options) {
    if (!options.model)
        throw new Error('Required option missing: `model`');
    var self = this;
    
    self._model = options.model;
    
    var defaultOptions = {
        cookie: false,
        header: true,
        require: false
    };
    
    self._options = _.extend(defaultOptions, _.pick(options, _.keys(defaultOptions)));
}

/**
 * Returns a handler for authorizing the requests:
 *
 *   function(req, res, next);
 *
 * Will pass Error object to next handler in case if:
 *  - options.require is true but no access token was provided (code: 'AuthenticationRequired', http: 401)
 *  - access token was provided, but is invalid or expired (code: 'AccessTokenExpiredOrInvalid', http: 401)
 *
 * In case authentication was successful req.user will be set to object with fields `id` and `object`.
 */
OAuth.prototype.authorize = function(options) {
    var self = this;
    var options = _.extend(self._options, _.pick(options, _.keys(self._options)));
    
    return function(req, res, next) {
        // TODO
        return next();
    };
}

/**
 * Returns a handler for grant request.
 */
OAuth.prototype.grant = function(successHook, errorHook) {
    return function(req, res, next) {
        // TODO
    };
}

module.exports = OAuth;
