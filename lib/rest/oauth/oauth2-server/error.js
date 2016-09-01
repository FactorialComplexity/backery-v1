var errors = require('../../../utils/errors.js');

module.exports = function(type, description, err) {
    
    var message, stack;
    
    if (err) {
        message = err.message;
        stack = err.stack;
    } else {
        message = description;
        Error.captureStackTrace(this, this.constructor);
    }
    
    var headers = {
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache'
    };
    
    var error;

    switch (type) {
        case 'invalidClient':
            headers['WWW-Authenticate'] = 'Basic realm="Service"';
        /* falls through */
        case 'invalidGrant':
        case 'invalidRequest':
            error = new errors.BackeryBadRequestError(message);
        break;
    
        case 'tokenExpired':
            error = new errors.BackeryUnauthorizedError(message, 'TokenExpiredError');
        break;
        
        case 'invalidToken':
            error = new errors.BackeryUnauthorizedError(message, 'InvalidTokenError');
        break;
            
        case 'invalidCredentials':
            error = new errors.BackeryUnauthorizedError(message, 'InvalidCredentialsError');
        break;
        
        case 'userIsBlocked':
            error = new errors.BackeryUnauthorizedError(message, 'UserIsBlocked');
        break;
        
        case 'serverError':
            error = err ? err : new errors.BackeryError(message);
        break;
    }
    
    error.headers = headers;
    return error;
}
