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
     * Returns response opject unrestricted to any user access rights.
     */
    this.getResponseObjectUnrestricted = function() {
        return _object.toJSON();
    }
}

var CreateRequest = function(entity, values, Backer) {
    var _entity = entity;
    var _values = values;
    var _validationError;
    var _prepared;
    var _object;
    
    var self = this;
    
    function _prepare() {
        if (_.isUndefined(_valid))
            self.validate();
        
        if (_prepared)
            throw new Error('Request processing was already prepared');
        
        _object = _entity.create(_values);
        _prepared = true;
    }
    
    function _validate() {
        // TODO: validate values
        _valid = true;
    }
    
    _validate();
    if (!_validationError) {
        _prepare();
    }
    
    
    this.getValidationError = function() {
        return _validationError;
    }
    
    this.getEntity = function() {
        return _entity;
    }
    
    this.getObject = function() {
        return _object;
    }
    
    this.execute = function() {
        return new Backer.Promise(function(resolve, reject) {
            if (!_valid) {
                reject(_validationError);
            } else {
                _object.save().then(function(objectAgain) {
                    resolve(new CreateResponse(objectAgain));
                }, function(error) {
                    reject(error);
                });
            }
        });
    }
}

module.exports = CreateRequest;
