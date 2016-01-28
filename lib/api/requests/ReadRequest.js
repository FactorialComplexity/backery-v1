var _ = require('underscore');

var errors = require('../../utils/errors.js');

var ReadResponse = function(object) {
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

var ReadRequest = function(entity, objectId, Backer) {
    var _entity = entity;
    var _objectId = objectId;
    
    var self = this;
    
    this.getValidationError = function() {
        return undefined;
    }
    
    this.getEntity = function() {
        return _entity;
    }
    
    this.getObjectId = function() {
        return _objectId;
    }
    
    this.execute = function() {
        return new Backer.Promise(function(resolve, reject) {
            _entity.get(_objectId).then(function(object) {
                if (object) {
                    resolve(new ReadResponse(object));
                } else {
                    reject(new errors.BackerNotFoundError(_entity.getName() + ' (id: ' + _objectId + ') not found'));
                }
            }, function(error) {
                reject(error);
            });
        });
    }
}

module.exports = ReadRequest;
