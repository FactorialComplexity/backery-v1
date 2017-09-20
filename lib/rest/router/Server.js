var connect = require('connect');
var urlrouter = require('urlrouter');
var _ = require('underscore');
var http = require('http');

var REST = require('./REST.js');
var Web = require('./Web.js');

var Server = function(options) {
    var _app = connect(urlrouter());
    var _server, _listenSuccess;
    var _sites = {};
    
    var defaultOptions = {
        auth: null,
        acceptedContentType: []
    };
    var _options = _.extend(defaultOptions, _.pick(options, _.keys(defaultOptions)));
    
    var self = this;
    
    this.listen = function(port, callback) {
        _server = http.createServer(self.app);
        _server.on('error', (error) => {
            if (!_listenSuccess) { // failed to start listening
                callback(error);
            }
        });
        
        _server.listen(port, () => {
            _listenSuccess = true;
            callback();
        });
    }
    
    this.address = function() {
        return _server.address();
    }
    
    this.REST = function(path, options, initializer) {
        _sites[path] = new REST(_app, path, options);
        if (initializer)
            initializer(_sites[path]);
        return _sites[path];
    }
    
    this.Web = function(path, options, initializer) {
        _sites[path] = new Web(_app, path, options);
        if (initializer)
            initializer(_sites[path]);
        return _sites[path];
    }
}

module.exports = Server;
