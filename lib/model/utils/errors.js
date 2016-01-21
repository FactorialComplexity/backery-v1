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


errors.BackerDatabaseError = function(parent) {
    errors.BackerError.apply(this, [parent.message]);
    this.name = 'BackerDatabaseError';
};
util.inherits(errors.BackerDatabaseError, errors.BackerError);
