var _ = require('underscore');

var BackerObject = require('../BackerObject.js');

var errors = require('../../utils/errors.js');

var SequelizeNameMapper = require('./SequelizeNameMapper.js');

var SequelizeRelationImpl = function(objectImpl, fieldDefinition, context) {
    this.definition = fieldDefinition;
    this.objectImpl = objectImpl;
    
    this.context = context;
    this.Promise = context.Promise;
    this.promiseWrap = context.promiseWrap;
    this.SequelizeObjectImpl = context.SequelizeObjectImpl;
}

SequelizeRelationImpl.prototype.query = function() {
    
}

SequelizeRelationImpl.prototype._addOrSet = function(method, objects) {
    var self = this;
    
    var keys = _.map(objects, function(object) {
        if (!object.objectId()) {
            throw new errors.errors.BackerConsistencyError('Object should be saved before adding to relation');
        }
        
        return parseInt(object.objectId());
    });
    
    return self.promiseWrap(self.objectImpl.sequelizeInstance[method +
        SequelizeNameMapper.sequelizeAssociationAs(self.definition)](keys));
}

SequelizeRelationImpl.prototype.add = function(objects) {
    return this._addOrSet('add', objects);
}

SequelizeRelationImpl.prototype.set = function(objects) {
    return this._addOrSet('set', objects);
}

SequelizeRelationImpl.prototype.remove = function(objects) {
    var self = this;
    
    var keys = _.map(objects, function(object) {
        if (!object.objectId()) {
            throw new errors.errors.BackerConsistencyError('Object was not saved and cannot be removed from relation');
        }
        
        return parseInt(object.objectId());
    });
    
    return self.promiseWrap(self.objectImpl.sequelizeInstance['remove' +
        SequelizeNameMapper.sequelizeAssociationAs(self.definition)](keys));
}

SequelizeRelationImpl.prototype.fetch = function(limit, offset) {
    var self = this;
    
    limit = limit || 100;
    offset = offset || 0;
    
    return self.promiseWrap(self.objectImpl.sequelizeInstance['get' +
        SequelizeNameMapper.sequelizeAssociationAs(self.definition)]({offset: offset, limit: limit }), function(fetched) {
            self._offset = offset;
            self._limit = limit;
            
            return self._fetched = _.map(fetched, function(sequelizeInstance) {
                return new BackerObject(new self.SequelizeObjectImpl(sequelizeInstance, self.definition.type.relatedEntity, self.context)); 
            });
        });
}

SequelizeRelationImpl.prototype.fetched = function() {
    return self._fetched;
}

SequelizeRelationImpl.prototype.offset = function() {
    return self._offset;
}

SequelizeRelationImpl.prototype.limit = function() {
    return self._limit;
}

module.exports = SequelizeRelationImpl;
