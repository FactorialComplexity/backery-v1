var path = require('path');
var _ = require('underscore');
var SandboxedModule = require('sandboxed-module');

var TrustedExtensionsRunner = function(rootFilePath, applicationName, Backery) {
    var self = this;
    
    var _installing = true;
    var _customEndpoints = [];
    
    function customEndpointCollector(method) {
        if (!_installing) {
            throw new Error('Cannot install new handler after extension code was already loaded');
        }
        
        return function(path, handler) {
            if (path[0] != '/')
                path = '/' + path;
            
            _customEndpoints.push({
                method: method,
                path: path,
                handler: handler
            });
        };
    }
    
    function hookCollector(type) {
        if (!_installing) {
            throw new Error('Cannot install new handler after extension code was already loaded');
        }
        
        return function(entity, callback) {
            
        };
    }
    
    if (rootFilePath) {
        var extensionsInstaller = {
            get: customEndpointCollector('get'),
            post: customEndpointCollector('post'),
            put: customEndpointCollector('put'),
            del: customEndpointCollector('del'),
            head: customEndpointCollector('head'),
            opts: customEndpointCollector('opts'),
            
            onRead: hookCollector('read'),
            onCreateOrUpdate: hookCollector('createOrUpdate'),
            onDelete: hookCollector('delete'),
            onQuery: hookCollector('query')
        };
        
        var globals = {
            Backery: _.extend(Backery, {
                Server: extensionsInstaller
            })
        };
        
        globals[applicationName] = Backery.Model;
        
        SandboxedModule.require(path.resolve(rootFilePath), {
            globals: globals,
            requireFilter: function(modulePath) {
                var node_modules_path = path.dirname(path.resolve(rootFilePath)) + '/node_modules';
                return modulePath.substring(0, node_modules_path.length) != node_modules_path;
            }
        });
        
        _installing = false;
    }
    
    self.getCustomEndpointsList = function() {
        return _.map(_customEndpoints, function(endpoint) {
            return {
                method: endpoint.method,
                path: endpoint.path
            };
        });
    }
    
    self.processEndpoint = function(method, path, req, res) {
        var endpoint = _.find(_customEndpoints, function(endpoint) {
            return endpoint.method == method && endpoint.path == path;
        });
        endpoint.handler(req, res);
    }
}

module.exports = TrustedExtensionsRunner;
