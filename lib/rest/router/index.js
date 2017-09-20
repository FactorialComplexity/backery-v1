var router = module.exports = { };

/*
 Usage:

var OAuth = new router.OAuth({
    
});
 
server.REST('/api', function(site) {
    site.get({
        path: '/objects/User/:id',
        accept: {
            body: false, // do not accept any kind of body, default - true
            contentType: 'application/json', // if request has a body it should be application/json
        },
        parameters: {
            include: {
                passedAs: 'query', // how the parameter should be passed
                required: false, // default - false
                validate: function(value) { // validates the parameter, should not be async, if throws - invalid  
                },
                transform: function(value) { // same as validat but returned value replaces the parameter in request
                }
            }
        }
    },
    function(req, res) {

    });

});

server.Web('/cms', {
    oauth: OAuth.config({
        cookie: true,
        headers: false
    })
},
function(site) {
    site.static('/css', '../css'); // serve static files
    site.static('/js', '../js'); // serve static files

    
});

*/

// Server provides:
//  - CORS responses (configurable via options)
//  - built-in OAuth (configurable via options)
//  - abstract routing and requests processing

router.Server = require('./Server.js');
router.OAuth = require('./OAuth.js');

