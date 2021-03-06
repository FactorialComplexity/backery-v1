var path = require('path');
var fs = require('fs');
var _ = require('lodash');
var check = require('syntax-error');
var shimmer = require('shimmer');
var SandboxedModule = require('sandboxed-module');

var TrustedExtensionsRunner = function(rootFilePath, applicationName, customConfig, Backery) {
    var self = this;
    
    var _installing = true;
    var _customEndpoints = [];
    var _requestHooks = {};
    var _databaseHooks = {};
    var _subApplications = {};
    var _onListenHooks = [];
    
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
        
        return function(entity, arg1, arg2) {
            var options, handler;
            
            if (arguments.length == 2) {
                options = {};
                handler = arg1;
            } else {
                options = arg1;
                handler = arg2;
            }
            
            if (!_requestHooks[entity.getName()])
                _requestHooks[entity.getName()] = {};
            
            if (_requestHooks[entity.getName()][type]) {
                throw new Error('Hook for ' + entity.getName() + ':' + type + ' was already installed');
            }
            
            _requestHooks[entity.getName()][type] = {
                options: options,
                handler: handler
            };
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
    
    function subApplicationsCollector() {
        if (!_installing) {
            throw new Error('Cannot install new handler after extension code was already loaded');
        }
        
        return function(mountpath, app) {
            _subApplications[mountpath] = app;
        }
    }
    
    function onListenHooksCollector() {
        if (!_installing) {
            throw new Error('Cannot install new handler after extension code was already loaded');
        }

        return function(handler) {
            _onListenHooks.push(handler)
        }
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
            onQuery: requestHookCollector('Query'),
            
            app: subApplicationsCollector(),
            onListenHooks: onListenHooksCollector(),
            
            path: function(inputPath) {
                return path.dirname(path.resolve(rootFilePath)) + '/' + inputPath;
            }
        };
        
        // Express
        var express = require('express');
        var injectedExpress = function() {
            var app = express.apply(this, arguments);
            shimmer.wrap(app, 'set', function(original) {
                return function () {
                    if (arguments[0] == 'views' && _.isString(arguments[1])) {
                        arguments[1] = path.dirname(path.resolve(rootFilePath)) + '/./' + arguments[1];
                    }
                    
                    var returned = original.apply(this, arguments)
                    return returned;
                };
            });
            return app;
        }
        
        injectedExpress.static = function () {
            if (_.isString(arguments[0])) {
                arguments[0] = path.dirname(path.resolve(rootFilePath)) + '/' + arguments[0];
            }
            
            return express.static.apply(this, arguments);
        };
        injectedExpress.Router = express.Router;
        
        
        // Model
        var Model = _.fromPairs(_.map(Backery.Model, function(entity, key) {
            return [key, _.extend(entity, {
                afterFetch: databaseHookCollector(entity, 'afterFetch'),
                
                beforeSave: databaseHookCollector(entity, 'beforeSave'),
                afterSave: databaseHookCollector(entity, 'afterSave'),
                
                beforeDestroy: databaseHookCollector(entity, 'beforeDestroy'),
                afterDestroy: databaseHookCollector(entity, 'afterDestroy')
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
        
        function checkFile(filePath) {
            var err = check(fs.readFileSync(filePath), filePath);
            if (err) {
                throw new Error('' + err);
            }
        }
        
        checkFile(path.resolve(rootFilePath));
        SandboxedModule.require(path.resolve(rootFilePath), {
            globals: globals,
            requireFilter: function(modulePath) {
                checkFile(modulePath);
                
                var node_modules_path = path.dirname(path.resolve(rootFilePath)) + '/node_modules';
                return modulePath.substring(0, node_modules_path.length) != node_modules_path;
            },
            fakeModules: {
                express: injectedExpress,
                hbs: require('hbs')
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
    
    self.getSubApplications = function() {
        return _subApplications;
    }
    
    self.hasRequestHook = function(request) {
        return _requestHooks[request.entity.getName()] && _requestHooks[request.entity.getName()][request.type];
    }
    
    self.getRequestHookOptions = function(request) {
        return _requestHooks[request.entity.getName()] ? _requestHooks[request.entity.getName()][request.type].options :
            undefined;
    }
    
    self.getDatabaseHook = function(entityName, type) {
        return _databaseHooks[entityName] ? _databaseHooks[entityName][type] : undefined; 
    }
    
    self.getOnListenHooks = function() {
        return _onListenHooks;
    }
    
    self.processRequest = function(request, response) {
        var entityHook;
        var entityHooks = _requestHooks[request.entity.getName()];
        if (entityHooks) {
            entityHook = entityHooks[request.type];
        }
        
        if (entityHook) {
            try {
                request.prepare(entityHook.options).then(function() {
                    var ret = entityHook.handler(request);
                    if (_.isUndefined(ret)) {
                        response.done(request.execute());
                    } else {
                        response.done(ret);
                    }
                }).catch(function(error) {
                    response.error(error);
                });
            } catch (error) {
                response.error(error);
            }
            
            return true;
        }
        
        return false;
    }
}

module.exports = TrustedExtensionsRunner;
