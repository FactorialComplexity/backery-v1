var util = require('util');
var errors = module.exports = {};

errors.BackerError = function() {
    var tmp = Error.apply(this, arguments);
    tmp.name = this.name = 'BackerError';

    this.message = tmp.message;
    if (Error.captureStackTrace)
        Error.captureStackTrace(this, this.constructor);
};

util.inherits(errors.BackerError, Error);


errors.BackeryDatabaseError = function(parent, reason) {
    errors.BackerError.apply(this, [parent.message]);
    this.name = 'BackeryDatabaseError';
    this.reason = reason;
};
util.inherits(errors.BackeryDatabaseError, errors.BackerError);


errors.BackeryTypeError = function(message) {
    errors.BackerError.apply(this, arguments);
    this.name = 'BackeryTypeError';
};
util.inherits(errors.BackeryTypeError, errors.BackerError);


errors.BackerConsistencyError = function(message) {
    errors.BackerError.apply(this, arguments);
    this.name = 'BackerConsistencyError';
};
util.inherits(errors.BackerConsistencyError, errors.BackerError);


errors.BackerNotFoundError = function(message) {
    errors.BackerError.apply(this, arguments);
    this.name = 'BackerNotFoundError';
};
util.inherits(errors.BackerNotFoundError, errors.BackerError);


errors.BackerInvalidParametersError = function(message, parameters) {
    errors.BackerError.apply(this, [message]);
    this.name = 'BackerInvalidParametersError';
    this.parameters = parameters;
};
util.inherits(errors.BackerInvalidParametersError, errors.BackerError);

