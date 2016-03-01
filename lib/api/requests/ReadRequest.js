var _ = require('underscore');

var errors = require('../../utils/errors.js');

var ReadRequest = function(entity, objectId, include, user, Backery) {
    var _entity = entity;
    var _objectId = objectId;
    var _include = include;
    
    var self = this;
    
    Object.defineProperty(this, 'user', { get: function() { return user; } });
    Object.defineProperty(this, 'entity', { get: function() { return _entity; } });
    Object.defineProperty(this, 'objectId', { get: function() { return _objectId; } });
    
    this.getValidationError = function() {
        return undefined;
    }
    
    this.execute = function() {
        return new Backery.Promise(function(resolve, reject) {
            _entity.get(_objectId, _include).then(function(object) {
                if (object) {
                    try {
                        resolve(object.toStruct());
                    } catch (error) {
                        reject(error);
                    }
                } else {
                    reject(new errors.BackeryNotFoundError(_entity.getName() + ' (id: ' + _objectId + ') not found'));
                }
            }, function(error) {
                reject(error);
            });
        });
    }
}

module.exports = ReadRequest;
