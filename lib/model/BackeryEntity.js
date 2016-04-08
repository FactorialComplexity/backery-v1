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
        try {
            include = definition.prepareInclude(include);
        } catch (error) {
            return Backery.Promise.reject(error);
        }
        
        return pimpl.get(id, include);
    }
    
    // Instantly creates and returns an unfetched BackeryObject with specified id
    this.ref = function(id, values) {
        var object = pimpl.ref(id);
        if (values) {
            object.setValues(values);
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
