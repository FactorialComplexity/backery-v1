var _ = require('underscore');

var errors = require('../utils/errors.js');

var ReadRequest = function(entity, objectId, include, user, Backery) {
    Object.defineProperty(this, 'type', { get: function() { return 'Read'; } });
    
    var _entity = entity;
    var _objectId = objectId;
    var _include = include;
    var _object;
    
    var self = this;
    
    Object.defineProperty(this, 'user', { get: function() { return user; } });
    Object.defineProperty(this, 'entity', { get: function() { return _entity; } });
    Object.defineProperty(this, 'objectId', { get: function() { return _objectId; } });
    Object.defineProperty(this, 'object', { get: function() { return _object; } });
    
    this.getValidationError = function() {
        return undefined;
    }
    
    this.prepare = function(options) {
        return Backery.Promise.resolve(self);
    }
    
    this.executeRead = function() {
        return _entity.get(_objectId, _include);
    }
    
    this.serializeReadResult = function(object, options) {
        var serializer = (options && options.serializer) ? options.serializer :
            function(object) { return object.toStruct({ user: user }) };
        
        _object = object;
        
        try {
            return Backery.Promise.resolve(serializer(object));
        } catch (error) {
            return Backery.Promise.reject(error);
        }
    }
    
    this.rejectWithNotFoundError = function() {
        return Backery.Promise.reject(new errors.BackeryNotFoundError(_entity.getName() + ' (id: ' +
            _objectId + ') not found'));
    }
    
    this.execute = function(options) {
        return self.executeRead().then(function(object) {
            if (object) {
                return self.serializeReadResult(object, options);
            } else {
                return self.rejectWithNotFoundError();
            }
        });
    }
}

module.exports = ReadRequest;
