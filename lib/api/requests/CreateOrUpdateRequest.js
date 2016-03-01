var _ = require('underscore');

var errors = require('../../utils/errors.js');

var CreateOrUpdateRequest = function(object) {
    var _object = object;
    
    var self = this;
    
    this.getObject = function() {
        return _object;
    }
    
    /**
     * Returns response object in user's perspective, honoring any access rights that user have.
     * @param user user to use perspective, if undefined the perspective of user who issued the request is used.
     */
    this.getResponseObject = function(user) {
        // TODO: if user is not specified use default user
        return _object.toJSON(user);
    }
    
    /**
     * Returns response object unrestricted to any user access rights.
     */
    this.getResponseObjectUnrestricted = function() {
        return _object.toJSON();
    }
}

var CreateOrUpdateRequest = function(entity, objectId, values, include, user, Backery) {
    var _entity = entity;
    var _validationError;
    var _objectId = objectId;
    var _values = values;
    
    var self = this;
    
    try {
        if (_objectId) {
            _object = _entity.ref(_objectId, _values);
        } else {
            _object = _entity.create(_values);
        }
    } catch (error) {
        _validationError = error;
    } 
    
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
    
    this.execute = function(doNotFetch) {
        var doNotFetch = options && options.doNotFetch;
        
        if (_objectId) {
            return new Backery.Promise(function(resolve, reject) {
                if (_validationError) {
                    reject(_validationError);
                } else {
                    if (doNotFetch) {
                        _object.save().then(function(objectAgain) {
                            resolve(new UpdateResponse(objectAgain));
                        }, function(error) {
                            reject(_makeDatabaseErrorRelevant(error));
                        });
                    } else {
                        _object.save().then(function() {
                            _entity.get(_objectId, include).then(function(objectAgain) {
                                resolve(new UpdateResponse(objectAgain));
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
                                resolve(new CreateResponse(objectAgain));
                            });
                        } else {
                            resolve(new CreateResponse(objectAgain));
                        }
                    }, function(error) {
                        reject(_makeDatabaseErrorRelevant(error));
                    });
                }
            });
        }
    }
}

module.exports = CreateOrUpdateRequest;
