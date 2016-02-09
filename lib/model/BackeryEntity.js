var _ = require('underscore');
var errors = require('../utils/errors.js');

var BackeryRelationOperation = require('./BackeryRelationOperation.js');

var BackeryEntity = function(definition, impl) {
    var pimpl = impl;
    var self = this;
    
    // Create new instance of the entity of BackeryObject type and immediately returns
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
    
    // Fetches an object by id, returns Backery.Promise
    this.get = function(id, include) {
        return pimpl.get(id, definition.prepareInclude(include));
    }
    
    // Instantly creates and returns an unfetched BackeryObject with specified id
    this.ref = function(id, values) {
        var prepared = values ? definition.prepareValues(values, pimpl.getAllEntities()) : undefined;
        var object = pimpl.ref(id, prepared);
        
        if (values) {
            _.map(definition.fields, function(fieldDefinition) {
                if (fieldDefinition.type.isRelationMany() && values[fieldDefinition.name]) {
                    object.relation(fieldDefinition.name).setOperation(prepared[fieldDefinition.name]);
                }
            });
        }
        
        return object;
    }
    
    // Instantly loads and returns BackeryObject with preloaded data
    this.load = function(values) {
        return pimpl.load(id);
    }
    
    // Create new BackeryQuery instance for the entity and immediately returns
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
            return BackeryRelationOperation.Set(objectIds, self);
        },
        
        Add: function(objectIds) {
            return BackeryRelationOperation.Add(objectIds, self);
        },
        
        Remove: function(objectIds) {
            return BackeryRelationOperation.Remove(objectIds, self);
        },
        
        load: function(data) {
            return new BackeryRelationOperation(data, self);
        }
    }
}

module.exports = BackeryEntity;
