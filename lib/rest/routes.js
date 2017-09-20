var router = require('./router');
var OAuthModel = require('./oauth/OAuthModel.js');

module.exports = function(application, config) {
    
    var server = new router.Server();
    var oauth = new router.OAuth({
        model: new OAuthModel(application) 
    });

    var CORS_ALLOW_HEADERS = [
        "authorization",
        "withcredentials",
        "x-requested-with",
        "x-forwarded-for",
        "x-real-ip",
        "x-customheader",
        "user-agent",
        "keep-alive",
        "host",
        "accept",
        "connection",
        "upgrade",
        "content-type",
        "dnt", // Do not track
        "if-modified-since",
        "cache-control"
    ];
    
    var CORS_ALLOW_METHODS = [
        "GET",
        "POST",
        "PUT",
        "DELETE"
    ];
    
    // API
    server.REST('/api', {
        auth: oauth.authorize({
            cookie: true,
            header: true
        }),
        acceptedContentType: 'application/json',
        cors: {
            allowCredentials: true,
            allowHeaders: CORS_ALLOW_HEADERS.join(', '),
            allowMethods: CORS_ALLOW_METHODS.join(', '),
            allowOrigin: function(req) {
                return req.headers.origin;
            },
            maxAge: 0,
            
            respondToOptions: true
        }
    }, function(rest) {
        
    });
    
    // Listen
    return new application.Backery.Promise(function(resolve, reject) {
        server.listen(config.port, function(error) {
            if (!error) {
                resolve({
                    address: server.address()
                });
            } else {
                reject(error);
            }
        });
    });
};
