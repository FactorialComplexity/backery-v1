var _ = require('underscore');

var BackeryObject = require('../BackeryObject.js');
var SequelizeNameMapper = require('./SequelizeNameMapper.js');

var errors = require('../../utils/errors.js');

var SequelizeNameMapper = require('./SequelizeNameMapper.js');

var SequelizeRelationImpl = function(objectImpl, fieldDefinition, context, include) {
    this.definition = fieldDefinition;
    this.objectImpl = objectImpl;
    
    this.context = context;
    this.Promise = context.Promise;
    this.promiseWrap = context.promiseWrap;
    this.SequelizeObjectImpl = context.SequelizeObjectImpl;
    
    var self = this;
    var eagerLoaded = self.objectImpl.sequelizeInstance[SequelizeNameMapper.sequelizeAssociationAs(self.definition)];
    self._fetched = eagerLoaded ? _.map(eagerLoaded, function(sequelizeInstance) {
        return new BackeryObject(new self.SequelizeObjectImpl(sequelizeInstance, self.definition.type.relatedEntity, self.context));
    }) : undefined;
    
    var fieldInclude = _.find(include, function(inc) { return inc.field == self.definition.name; });
    self._offset = fieldInclude ? fieldInclude.offset : undefined;
    self._limit = fieldInclude ? fieldInclude.limit : undefined;
}

SequelizeRelationImpl.prototype.query = function() {
    
}

SequelizeRelationImpl.prototype._addOrSet = function(method, objects, context) {
    var self = this;
    
    var keys = _.map(objects, function(object) {
        if (!object.objectId()) {
            throw new errors.errors.BackeryConsistencyError('Object should be saved before adding to relation');
        }
        
        return parseInt(object.objectId());
    });
    
    return self.promiseWrap(self.objectImpl.sequelizeInstance[method +
        SequelizeNameMapper.sequelizeAssociationAs(self.definition)](keys, context ? { transaction: context } : undefined));
}

SequelizeRelationImpl.prototype.add = function(objects, context) {
    return this._addOrSet('add', objects, context);
}

SequelizeRelationImpl.prototype.set = function(objects, context) {
    return this._addOrSet('set', objects, context);
}

SequelizeRelationImpl.prototype.remove = function(objects, context) {
    var self = this;
    
    var keys = _.map(objects, function(object) {
        if (!object.objectId()) {
            throw new errors.errors.BackeryConsistencyError('Object was not saved and cannot be removed from relation');
        }
        
        return parseInt(object.objectId());
    });
    
    return self.promiseWrap(self.objectImpl.sequelizeInstance['remove' +
        SequelizeNameMapper.sequelizeAssociationAs(self.definition)](keys, context ? { transaction: context } : undefined));
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
                return new BackeryObject(new self.SequelizeObjectImpl(sequelizeInstance, self.definition.type.relatedEntity, self.context)); 
            });
        });
}

SequelizeRelationImpl.prototype.fetched = function() {
    return this._fetched;
}

SequelizeRelationImpl.prototype.offset = function() {
    return this._offset;
}

SequelizeRelationImpl.prototype.limit = function() {
    return this._limit;
}

module.exports = SequelizeRelationImpl;
