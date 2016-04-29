var _ = require('underscore');

var errors = require('../../utils/errors.js');

var CreateOrUpdateRequest = function(entity, objectId, values, file, include, user, Backery, configureObject) {
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
                    _object = _entity.ref(_objectId, _values);
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
        
        if (_objectId) {
            return new Backery.Promise(function(resolve, reject) {
                if (_validationError) {
                    reject(_validationError);
                } else {
                    if (doNotFetch) {
                        _object.save().then(function(objectAgain) {
                            resolve(objectAgain.toStruct());
                        }, function(error) {
                            reject(_makeDatabaseErrorRelevant(error));
                        });
                    } else {
                        _object.save().then(function() {
                            _entity.get(_objectId, include).then(function(objectAgain) {
                                resolve(objectAgain.toStruct());
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
                        if (_.isArray(include) && include.length > 0) {
                            objectAgain.fetch(include).then(function(objectAgain) {
                                resolve(objectAgain.toStruct());
                            }, function(error) {
                                reject(error);
                            });
                        } else {
                            resolve(objectAgain.toStruct());
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
