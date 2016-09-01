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
    this.name = 'BackeryDatabaseError';
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
    
    this.status = 422;
    this.code = 'ConsistencyError';
    this.hasMessageForBackery = true;
};
util.inherits(errors.BackeryConsistencyError, errors.BackeryError);


errors.BackeryNotFoundError = function(message) {
    errors.BackeryError.apply(this, arguments);
    
    this.status = 404;
    this.code = 'NotFoundError';
    this.hasMessageForBackery = true;
};
util.inherits(errors.BackeryNotFoundError, errors.BackeryError);


errors.BackeryUnsupportedError = function(message) {
    errors.BackeryError.apply(this, arguments);
    
    this.status = 501;
    this.code = 'UnsupportedError';
    this.hasMessageForBackery = true;
};
util.inherits(errors.BackeryUnsupportedError, errors.BackeryError);


errors.BackeryInvalidParametersError = function(message, parameters) {
    errors.BackeryError.apply(this, [message]);
    this.parameters = parameters;
    
    this.status = 422;
    this.code = 'InvalidParametersError';
    this.hasMessageForBackery = true;
};
util.inherits(errors.BackeryInvalidParametersError, errors.BackeryError);


errors.BackeryBadRequestError = function(message) {
    errors.BackeryError.apply(this, [message]);
    
    this.status = 400;
    this.code = 'BadRequestError';
    this.hasMessageForBackery = true;
};
util.inherits(errors.BackeryBadRequestError, errors.BackeryError);

errors.BackeryUnauthorizedError = function(message, code) {
    errors.BackeryError.apply(this, [message]);
    
    this.status = 401;
    this.code = code || 'UnauthorizedError';
    this.hasMessageForBackery = true;
};
util.inherits(errors.BackeryUnauthorizedError, errors.BackeryError);
