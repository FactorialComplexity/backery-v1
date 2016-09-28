var errors = require('../../../utils/errors.js');

module.exports = function grant(auth, config, Backery) {
    var Authenticate = function(req) {
        var self = this;
        
        this.process = function() {
            // getBearerToken
            var headerToken = req.header('Authorization'),
                getToken =  req.query.access_token,
                postToken = req.body ? req.body.access_token : undefined;

            // Check exactly one method was used
            var methodsUsed = (headerToken !== undefined) + (getToken !== undefined) +
                (postToken !== undefined);

            if (methodsUsed > 1) {
                return Backery.Promise.reject(new errors.BackeryBadRequestError(
                    'Only one method may be used to authenticate at a time (Auth header, GET or POST'));
            } else if (methodsUsed === 0) { // no access token found
                return Backery.Promise.resolve();
            }

            // Header: http://tools.ietf.org/html/rfc6750#section-2.1
            if (headerToken) {
                var matches = headerToken.match(/Bearer\s(\S+)/);

                if (!matches) {
                    return Backery.Promise.reject(new errors.BackeryBadRequestError('Malformed auth header'));
                }
                
                headerToken = matches[1];
            }

            // POST: http://tools.ietf.org/html/rfc6750#section-2.2
            if (postToken) {
                if (req.method === 'GET') {
                    return Backery.Promise.reject(new errors.BackeryBadRequestError(
                        'Method cannot be GET When putting the token in the body'));
                }

                if (!req.is('application/x-www-form-urlencoded')) {
                    return Backery.Promise.reject(new errors.BackeryBadRequestError(
                        'When putting the token in the body, content type must be application/x-www-form-urlencoded.'));
                }
            }

            var bearerToken = headerToken || postToken || getToken;
            
            return auth.getAccessToken(bearerToken).then(function(token) {
                if (!token) {
                    return Backery.Promise.reject(new errors.BackeryUnauthorizedError('The access token provided is invalid',
                        'TokenExpiredError'));
                }

                if (token.expires !== null && (!token.expires || token.expires < new Date())) {
                    return Backery.Promise.reject(new errors.BackeryUnauthorizedError('The access token provided has expired',
                        'TokenExpiredError'));
                }

                if (token.user && token.user.get('blocked')) {
                    return Backery.Promise.reject(new errors.BackeryUnauthorizedError('User is blocked', 'UserIsBlocked'));
                }

                // Expose params
                self.req.oauth = { bearerToken: token };
                self.req.user = token.user;
                
                return Backery.Promise.resolve(token.user);
            });
        }
    }
        
    return Authenticate;
}
