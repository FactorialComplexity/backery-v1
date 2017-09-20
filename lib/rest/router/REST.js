var Site = require('./Site.js');
var util = require('util');

var REST = function(app, path, options) {
    var defaultOptions = {
        auth: null,
        acceptedContentType: 'application/json',
    };
    
    Site.apply(this, [app, path, options, defaultOptions]);
}

util.inherits(REST, Site);
module.exports = REST;
