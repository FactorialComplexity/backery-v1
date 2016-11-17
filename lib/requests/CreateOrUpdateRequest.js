var _ = require('underscore');

var errors = require('../utils/errors.js');

var CreateOrUpdateRequest = function(entity, objectId, values, file, include, user, Backery, configureObject, requestOptions) {
    Object.defineProperty(this, 'type', { get: function() { return 'CreateOrUpdate'; } });
    
    var _entity = entity;
    var _validationError;
    var _objectId = objectId;
    var _values = values;
    var _object;
    
    var self = this;
    
    Object.defineProperty(this, 'user', { get: function() { return user; } });
    Object.defineProperty(this, 'entity', { get: function() { return _entity; } });
    Object.defineProperty(this, 'object', { get: function() { return _object; } });
    Object.defineProperty(this, 'objectId', { get: function() { return _objectId; } });
    Object.defineProperty(this, 'values', { get: function() { return _values; } });
    
    /**
     * Master requests are not subjects to regular access checks.
     */
    Object.defineProperty(this, 'isMaster', { get: function() { return requestOptions && !!requestOptions.isMaster; } });
    
    this.getValidationError = function() {
        return _validationError;
    }
    
    function _makeDatabaseErrorRelevant(error) {
        if (error.name == 'BackeryDatabaseError' && error.reason == 'BackeryObjectsNotFound') {
            return new errors.BackeryInvalidParametersError('Some objects do not exist');
        } else {
            return error;
        }
    }
    
    this.isNew = function() {
        return !_objectId;
    }
    
    this.prepare = function(options) {
        options = _.extend({
            prefetch: false
        }, options);
        
        function configureObjectAndReturn() {
            if (configureObject) {
                configureObject(_object);
            }
            
            if (_entity.getDefinition().isUserEntity()) {
                try {
                    _object.validatePasswordAuthentication();
                } catch (error) {
                    _validationError = error;
                    return Backery.Promise.reject(_validationError);
                }
            }
            
            return Backery.Promise.resolve(self);
        }
        
        if (!options.prefetch || !_objectId) {
            try {
                if (_objectId) {
                    _object = _entity.load(_objectId, _values);
                } else {
                    _object = _entity.create(_values);
                    if (file) {
                        if (_.isFunction(_object.setFileBody)) {
                            _object.setFileBody(file);
                        } else {
                            return Backery.Promise.reject(new errors.BackeryInvalidParametersError('Cannot set file body for entity `'
                                + _entity.name + '`'));
                        }
                    }
                }
            } catch (error) {
                _validationError = error;
                return Backery.Promise.reject(_validationError);
            }
            
            return configureObjectAndReturn();
        } else {
            return _entity.get(_objectId, include).then(function(object) {
                _object = object;
                _object.setValues(_values);
                
                if (file) {
                    if (_.isFunction(_object.setFileBody)) {
                        _object.setFileBody(file);
                    } else {
                        return Backery.Promise.reject(new errors.BackeryInvalidParametersError('Cannot set file body for entity `'
                            + _entity.name + '`'));
                    }
                }
                
                return configureObjectAndReturn();
            });
        }
    };
    
    this.execute = function(options) {
        var doNotFetch = options && options.doNotFetch;
        var serializer = (options && options.serializer) ||
            function(object) { return object.toStruct({ user: user }) };
        
        if (_objectId) {
            return new Backery.Promise(function(resolve, reject) {
                if (_validationError) {
                    reject(_validationError);
                } else {
                    if (doNotFetch) {
                        _object.save().then(function(objectAgain) {
                            if (objectAgain) {
                                resolve(objectAgain.toStruct());
                            } else {
                                reject(new errors.BackeryNotFoundError(_entity.getName() + ' (id: ' + objectId + ') not found'));
                            }
                        }, function(error) {
                            reject(_makeDatabaseErrorRelevant(error));
                        });
                    } else {
                        _object.save().then(function() {
                            _entity.get(_objectId, include).then(function(objectAgain) {
                                if (objectAgain) {
                                    resolve(serializer(objectAgain));
                                } else {
                                    reject(new errors.BackeryNotFoundError(_entity.getName() + ' (id: ' + objectId + ') not found'));
                                }
                            }, function(error) {
                                reject(_makeDatabaseErrorRelevant(error));
                            });
                        }, function(error) {
                            reject(_makeDatabaseErrorRelevant(error));
                        });
                    }
                }
            });
        } else {
            return new Backery.Promise(function(resolve, reject) {
                if (_validationError) {
                    reject(_validationError);
                } else {
                    _object.save().then(function(objectAgain) {
                        var hasRelationOneToFile = _.some(_entity.getDefinition().fields, function(field) {
                            return field.type.isRelationOne() && field.type.relatedEntity.isFileEntity();
                        });
                        
                        if ((_.isArray(include) && include.length > 0) || hasRelationOneToFile) {
                            objectAgain.fetch(include).then(function(objectAgain) {
                                resolve(serializer(objectAgain));
                            }, function(error) {
                                reject(error);
                            });
                        } else {
                            resolve(serializer(objectAgain));
                        }
                    }).catch(function(error) {
                        reject(_makeDatabaseErrorRelevant(error));
                    });
                }
            });
        }
    }
}

module.exports = CreateOrUpdateRequest;
