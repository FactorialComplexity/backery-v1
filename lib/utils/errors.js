var util = require('util');
var errors = module.exports = {};

errors.BackeryError = function() {
    var tmp = Error.apply(this, arguments);

    this.message = tmp.message;
    if (Error.captureStackTrace)
        Error.captureStackTrace(this, this.constructor);
};

util.inherits(errors.BackeryError, Error);


errors.BackeryDatabaseError = function(parent, reason, details) {
    errors.BackeryError.apply(this, [parent.message]);
    this.reason = reason;
    this.details = details;
};
util.inherits(errors.BackeryDatabaseError, errors.BackeryError);


errors.BackeryTypeError = function(message) {
    errors.BackeryError.apply(this, arguments);
    this.hasMessageForBackery = true;
};
util.inherits(errors.BackeryTypeError, errors.BackeryError);


errors.BackeryConsistencyError = function(message) {
    errors.BackeryError.apply(this, arguments);
    
    this.code = 422;
    this.status = 'ConsistencyError';
    this.hasMessageForBackery = true;
};
util.inherits(errors.BackeryConsistencyError, errors.BackeryError);


errors.BackeryNotFoundError = function(message) {
    errors.BackeryError.apply(this, arguments);
    
    this.code = 404;
    this.status = 'NotFoundError';
    this.hasMessageForBackery = true;
};
util.inherits(errors.BackeryNotFoundError, errors.BackeryError);


errors.BackeryUnsupportedError = function(message) {
    errors.BackeryError.apply(this, arguments);
    
    this.code = 501;
    this.status = 'UnsupportedError';
    this.hasMessageForBackery = true;
};
util.inherits(errors.BackeryUnsupportedError, errors.BackeryError);


errors.BackeryInvalidParametersError = function(message, parameters) {
    errors.BackeryError.apply(this, [message]);
    this.parameters = parameters;
    
    this.code = 422;
    this.status = 'InvalidParametersError';
    this.hasMessageForBackery = true;
};
util.inherits(errors.BackeryInvalidParametersError, errors.BackeryError);


errors.BackeryBadRequestError = function(message) {
    errors.BackeryError.apply(this, [message]);
    
    this.code = 400;
    this.status = 'BadRequestError';
    this.hasMessageForBackery = true;
};
util.inherits(errors.BackeryBadRequestError, errors.BackeryError);

errors.BackeryUnauthorizedError = function(message) {
    errors.BackeryError.apply(this, [message]);
    
    this.code = 401;
    this.status = 'UnauthorizedError';
    this.hasMessageForBackery = true;
};
util.inherits(errors.BackeryUnauthorizedError, errors.BackeryError);
