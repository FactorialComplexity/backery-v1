var _ = require('underscore');

var errors = require('../../utils/errors.js');

var DeleteResponse = function(objectId) {
    var _objectId = objectId;
    
    var self = this;
    
    this.getObjectId = function() {
        return _objectId;
    }
    
    this.getResponseObject = function() {
        return null;
    }
}

var DeleteRequest = function(entity, objectId, user, Backery) {
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
    
    this.execute = function(doNotFetch) {
        return (doNotFetch ? Backery.Promise.resolve(_entity.ref(_objectId)) : _entity.get(_objectId)).then(function(object) {
            if (object) {
                return object.destroy();
            } else {
                return Backery.Promise.reject(new errors.BackeryNotFoundError(_entity.getName() + ' (id: ' + _objectId + ') not found'));
            }
        }).then(function() {
            return Backery.Promise.resolve(new DeleteResponse(_objectId));
        });
    }
}

module.exports = DeleteRequest;
