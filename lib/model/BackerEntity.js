var _ = require('underscore');

var BackerRelationOperation = require('./BackerRelationOperation.js');

var BackerEntity = function(definition, impl) {
    var pimpl = impl;
    var self = this;
    
    // Create new instance of the entity of BackerObject type and immediately returns
    this.create = function(values) {
        var prepared = definition.prepareValues(values, pimpl.getAllEntities());
        var object = pimpl.create(prepared, true);
        
        _.map(definition.fields, function(fieldDefinition) {
            if (fieldDefinition.type.isRelationMany() && values[fieldDefinition.name]) {
                object.relation(fieldDefinition.name).setOperation(prepared[fieldDefinition.name]);
            }
        });
        
        return object;
    }
    
    // Fetches an object by id, returns Backer.Promise
    this.get = function(id) {
        return pimpl.get(id);
    }
    
    // Instantly creates and returns an unfetched BackerObject with specified id
    this.ref = function(id, values) {
        return pimpl.ref(id, values);
    }
    
    // Instantly loads and returns BackerObject with preloaded data
    this.load = function(values) {
        return pimpl.load(id);
    }
    
    // Create new BackerQuery instance for the entity and immediately returns
    this.query = function() {
        return pimpl.query();
    }
    
    this.getDefinition = function() {
        return definition;
    }
    
    this.getName = function() {
        return definition.name;
    }
    
    this.RelationOperation = {
        Set: function(objectIds) {
            return BackerRelationOperation.Set(objectIds, self);
        },
        
        Add: function(objectIds) {
            return BackerRelationOperation.Add(objectIds, self);
        },
        
        Remove: function(objectIds) {
            return BackerRelationOperation.Remove(objectIds, self);
        },
        
        load: function(data) {
            return new BackerRelationOperation(data, self);
        }
    }
}

module.exports = BackerEntity;
