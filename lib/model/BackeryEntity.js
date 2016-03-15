var _ = require('underscore');
var errors = require('../utils/errors.js');

var BackeryRelationOperation = require('./BackeryRelationOperation.js');

var BackeryEntity = function(definition, impl, Backery) {
    var pimpl = impl;
    var self = this;
    
    // Creates new instance of the entity of BackeryObject type and immediately returns
    this.create = function(values) {
        var object = pimpl.create();
        object.setValues(values);
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
        
        if (prepared) {
            _.map(definition.fields, function(fieldDefinition) {
                if (fieldDefinition.type.isRelationMany() && prepared[fieldDefinition.name]) {
                    object.relation(fieldDefinition.name).setOperation(prepared[fieldDefinition.name]);
                } else if (fieldDefinition.type.isRelationOne() && prepared[fieldDefinition.name]) {
                    object.set(fieldDefinition.name, prepared[fieldDefinition.name]);
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
        Set: function(objects) {
            return BackeryRelationOperation.Set(objects, self);
        },
        
        AddRemove: function(add, remove) {
            return BackeryRelationOperation.Add(add, remove, self);
        },
        
        FromData: function(data) {
            return BackeryRelationOperation.FromData(data, self);
        },
    }
}

module.exports = BackeryEntity;
