var _ = require('underscore');

var errors = require('../../utils/errors.js');

var CreateResponse = function(object) {
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

var CreateRequest = function(entity, values, Backery) {
    var _entity = entity;
    var _values = values;
    var _validationError;
    var _object;
    
    var self = this;
    
    function _prepare() {
        try {
            _object = _entity.create(_values);
        } catch (error) {
            _validationError = error;
        } 
    }
    
    _prepare();
    
    this.getValidationError = function() {
        return _validationError;
    }
    
    this.setValidationError = function(error) {
        _validationError = error;
    }
    
    this.getEntity = function() {
        return _entity;
    }
    
    this.getObject = function() {
        return _object;
    }
    
    function _makeDatabaseErrorRelevant(error) {
        if (error.type == 'BackeryDatabaseError' && error.reason == 'BackeryObjectsNotFound') {
            return new errors.BackeryInvalidParametersError('Some objects do not exist');
        } else {
            return error;
        }
    }
    
    this.execute = function() {
        return new Backery.Promise(function(resolve, reject) {
            if (_validationError) {
                reject(_validationError);
            } else {
                _object.save().then(function(objectAgain) {
                    resolve(new CreateResponse(objectAgain));
                }, function(error) {
                    reject(_makeDatabaseErrorRelevant(error));
                });
            }
        });
    }
}

module.exports = CreateRequest;
