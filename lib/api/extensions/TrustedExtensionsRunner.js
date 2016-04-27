var path = require('path');
var _ = require('lodash');
var SandboxedModule = require('sandboxed-module');

var TrustedExtensionsRunner = function(rootFilePath, applicationName, customConfig, Backery) {
    var self = this;
    
    var _installing = true;
    var _customEndpoints = [];
    var _requestHooks = {};
    var _databaseHooks = {};
    
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
    
    function requestHookCollector(type) {
        if (!_installing) {
            throw new Error('Cannot install new handler after extension code was already loaded');
        }
        
        return function(entity, callback) {
            if (!_requestHooks[entity.getName()])
                _requestHooks[entity.getName()] = {};
            
            if (_requestHooks[entity.getName()][type]) {
                throw new Error('Hook for ' + entity.getName() + ':' + type + ' was already installed');
            }
            
            _requestHooks[entity.getName()][type] = callback;
        };
    }
    
    function databaseHookCollector(entity, type) {
        if (!_installing) {
            throw new Error('Cannot install new handler after extension code was already loaded');
        }
        
        return function(callback) {
            if (!_databaseHooks[entity.getName()])
                _databaseHooks[entity.getName()] = {};
            
            if (_databaseHooks[entity.getName()][type]) {
                throw new Error('Hook for ' + entity.getName() + ':' + type + ' was already installed');
            }
            
            _databaseHooks[entity.getName()][type] = callback;
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
            
            onRead: requestHookCollector('Read'),
            onCreateOrUpdate: requestHookCollector('CreateOrUpdate'),
            onDelete: requestHookCollector('Delete'),
            onQuery: requestHookCollector('Query')
        };
        
        var Model = _.fromPairs(_.map(Backery.Model, function(entity, key) {
            return [key, _.extend(entity, {
                beforeSave: databaseHookCollector(entity, 'beforeSave'),
                afterSave: databaseHookCollector(entity, 'afterSave')
            })];
        }));
        
        var globals = {
            Backery: _.extend(Backery, {
                Server: extensionsInstaller,
                Config: customConfig,
                Model: Model
            })
        };
        
        globals[applicationName] = globals.Backery.Model;
        
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
        return _.fromPairs(_.map(_requestHooks, function(entityHooks, entityName) {
            return [entityName, _.keys(entityHooks)];
        }));
    }
    
    self.getDatabaseHooks = function() {
        return _.fromPairs(_.map(_databaseHooks, function(entityHooks, entityName) {
            return [entityName, _.keys(entityHooks)];
        }));
    }
    
    self.hasRequestHook = function(request) {
        return _requestHooks[request.entity.getName()] && _requestHooks[request.entity.getName()][request.type];
    }
    
    self.getDatabaseHook = function(entityName, type) {
        return _databaseHooks[entityName] ? _databaseHooks[entityName][type] : undefined; 
    }
    
    self.processRequest = function(request, response) {
        var entityHook;
        var entityHooks = _requestHooks[request.entity.getName()];
        if (entityHooks) {
            entityHook = entityHooks[request.type];
        }
        
        if (entityHook) {
            try {
                var ret = entityHook(request);
                if (_.isUndefined(ret)) {
                    response.done(request.execute());
                } else {
                    response.done(ret);
                }

            } catch (error) {
                response.error(error);
            }
            return true;
        }
        
        return false;
    }
}

module.exports = TrustedExtensionsRunner;
