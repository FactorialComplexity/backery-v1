var _ = require('underscore');

var errors = require('../../utils/errors.js');

var UpdateResponse = function(object) {
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

var UpdateRequest = function(entity, objectId, values, Backer) {
    var _entity = entity;
    var _validationError;
    var _objectId = objectId;
    var _values = values;
    
    var self = this;
    
    function _prepare() {
        try {
            _object = _entity.ref(_objectId, _values);
        } catch (error) {
            _validationError = error;
        } 
    }
    
    _prepare();
    
    this.getValidationError = function() {
        return _validationError;
    }
    
    this.getEntity = function() {
        return _entity;
    }
    
    this.getObject = function() {
        return _object;
    }
    
    function _makeDatabaseErrorRelevant(error) {
        if (error.name == 'BackerDatabaseError' && error.reason == 'BackerObjectsNotFound') {
            return new errors.BackerInvalidParametersError('Some objects do not exist');
        } else {
            return error;
        }
    }
    
    this.execute = function(doNotFetch) {
        return new Backer.Promise(function(resolve, reject) {
            if (_validationError) {
                reject(_validationError);
            } else {
                
                if (doNotFetch) {
                    _entity.ref(_objectId, _values).save().then(function(objectAgain) {
                        resolve(new UpdateResponse(objectAgain));
                    }, function(error) {
                        reject(_makeDatabaseErrorRelevant(error));
                    });
                } else {
                    _entity.get(_objectId).then(function(object) {
                        if (object) {
                            object.setValues(values);
                            return object.save();
                        } else {
                            return Backer.Promise.reject(new errors.BackerNotFoundError(_entity.getName() + ' (id: ' + _objectId + ') not found'));
                        }
                    }).then(function(objectAgain) {
                        resolve(new UpdateResponse(objectAgain));
                    }, function(error) {
                        reject(_makeDatabaseErrorRelevant(error));
                    });
                }
            }
        });
    }
}

module.exports = UpdateRequest;
