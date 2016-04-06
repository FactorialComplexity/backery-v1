var connect = require('connect');
var _ = require('underscore');
var http = require('http');

var REST = require('./REST.js');
var Web = require('./Web.js');

var Server = function(options) {
    var _options = options || { };
    var _app = connect();
    var _server, _listenSuccess;
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
    
    this.REST = function(path) {
        
    }
    
    this.WEB = function(path) {
        
    }
}

module.exports = Server;
