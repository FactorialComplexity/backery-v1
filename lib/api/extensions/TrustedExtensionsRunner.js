var path = require('path');
var _ = require('underscore');
var SandboxedModule = require('sandboxed-module');

var TrustedExtensionsRunner = function(rootFilePath, applicationName, Backery) {
    var self = this;
    
    var _installing = true;
    var _customEndpoints = [];
    var _hooks = {};
    
    function customEndpointCollector(method) {
        if (!_installing) {
            throw new Error('Cannot install new handler after extension code was already loaded');
        }
        
        return function(path, handler) {
            if (path[0] != '/')
                path = '/' + path;
            
            // TODO: check this endpoint handler already installed
            
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
            if (!_hooks[entity.getName()])
                _hooks[entity.getName()] = {};
            
            if (_hooks[entity.getName()][type]) {
                throw new Error('Hook for ' + entity.getName() + ':' + type + ' was already installed');
            }
            
            _hooks[entity.getName()][type] = callback;
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
            
            onRead: hookCollector('Read'),
            onCreateOrUpdate: hookCollector('CreateOrUpdate'),
            onDelete: hookCollector('Delete'),
            onQuery: hookCollector('Query')
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
    
    self.processEndpoint = function(method, path, request, response) {
        var endpoint = _.find(_customEndpoints, function(endpoint) {
            return endpoint.method == method && endpoint.path == path;
        });
        endpoint.handler(request, response);
    }
    
    self.getRequestHooks = function() {
        return _.object(_.map(_hooks, function(entityHooks, entityName) {
            return [entityName, _.keys(entityHooks)];
        }));
    }
    
    self.hasHook = function(request) {
        return _hooks[request.entity.getName()] && _hooks[request.entity.getName()][request.type];
    }
    
    self.processRequest = function(request, response) {
        var entityHook;
        var entityHooks = _hooks[request.entity.getName()];
        if (entityHooks) {
            entityHook = entityHooks[request.type];
        }
        
        if (entityHook) {
            entityHook(request, response);
            return true;
        }
        
        return false;
    }
}

module.exports = TrustedExtensionsRunner;
