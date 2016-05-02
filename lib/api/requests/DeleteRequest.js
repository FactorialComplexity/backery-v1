var _ = require('underscore');

var errors = require('../../utils/errors.js');

var DeleteRequest = function(entity, objectId, user, Backery) {
    Object.defineProperty(this, 'type', { get: function() { return 'Delete'; } });
    
    var _entity = entity;
    var _objectId = objectId;
    var _object;
    
    var self = this;
    
    Object.defineProperty(this, 'user', { get: function() { return user; } });
    Object.defineProperty(this, 'entity', { get: function() { return _entity; } });
    Object.defineProperty(this, 'object', { get: function() { return _object; } });
    
    this.getValidationError = function() {
        return undefined;
    }
    
    this.prepare = function(options) {
        if (options.prefetch) {
            return _entity.get(_objectId).then(function(object) {
                _object = object;
                return Backery.Promise.resolve(self);
            });
        } else {
            _object = _entity.load(_objectId);
            return Backery.Promise.resolve(self);
        }
    }
    
    this.execute = function(options) {
        var doNotFetch = options && options.doNotFetch;
        
        return (doNotFetch ? Backery.Promise.resolve(_entity.load(_objectId)) : _entity.get(_objectId)).then(function(object) {
            if (object) {
                return object.destroy();
            } else {
                return Backery.Promise.reject(new errors.BackeryNotFoundError(_entity.getName() + ' (id: ' + _objectId + ') not found'));
            }
        }).then(function() {
            return Backery.Promise.resolve();
        });
    }
}

module.exports = DeleteRequest;
