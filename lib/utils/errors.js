var util = require('util');
var errors = module.exports = {};

errors.BackeryError = function() {
    var tmp = Error.apply(this, arguments);
    tmp.name = this.name = 'BackeryError';

    this.message = tmp.message;
    if (Error.captureStackTrace)
        Error.captureStackTrace(this, this.constructor);
};

util.inherits(errors.BackeryError, Error);


errors.BackeryDatabaseError = function(parent, reason, details) {
    errors.BackeryError.apply(this, [parent.message]);
    this.name = 'BackeryDatabaseError';
    this.reason = reason;
    this.details = details;
};
util.inherits(errors.BackeryDatabaseError, errors.BackeryError);


errors.BackeryTypeError = function(message) {
    errors.BackeryError.apply(this, arguments);
    this.name = 'BackeryTypeError';
};
util.inherits(errors.BackeryTypeError, errors.BackeryError);


errors.BackeryConsistencyError = function(message) {
    errors.BackeryError.apply(this, arguments);
    this.name = 'BackeryConsistencyError';
};
util.inherits(errors.BackeryConsistencyError, errors.BackeryError);


errors.BackeryNotFoundError = function(message) {
    errors.BackeryError.apply(this, arguments);
    this.name = 'BackeryNotFoundError';
};
util.inherits(errors.BackeryNotFoundError, errors.BackeryError);


errors.BackeryUnsupportedError = function(message) {
    errors.BackeryError.apply(this, arguments);
    this.name = 'BackeryUnsupportedError';
};
util.inherits(errors.BackeryUnsupportedError, errors.BackeryError);


errors.BackeryInvalidParametersError = function(message, parameters) {
    errors.BackeryError.apply(this, [message]);
    this.name = 'BackeryInvalidParametersError';
    this.parameters = parameters;
};
util.inherits(errors.BackeryInvalidParametersError, errors.BackeryError);


errors.BackeryBadRequestError = function(message) {
    errors.BackeryError.apply(this, [message]);
    this.name = 'BackeryBadRequestError';
};
util.inherits(errors.BackeryBadRequestError, errors.BackeryError);

errors.BackeryUnauthorizedError = function(message) {
    errors.BackeryError.apply(this, [message]);
    this.name = 'BackeryUnauthorizedError';
};
util.inherits(errors.BackeryUnauthorizedError, errors.BackeryError);
