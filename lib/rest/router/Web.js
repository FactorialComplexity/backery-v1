var Site = require('./Site.js');
var util = require('util');

var Web = function(app, path, options) {
    var defaultOptions = {
        auth: null,
        acceptedContentType: ['application/x-www-form-urlencoded', 'multipart/form-data'],
    };
    
    Site.apply(this, [app, path, options, defaultOptions]);
}

util.inherits(Web, Site);
module.exports = Web;
