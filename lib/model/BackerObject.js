var _ = require('underscore');
var errors = require('../utils/errors.js');

var BackerObject = function(impl, isRef) {
    //this.isRef = isRef;
    
    var pimpl = impl;
    var self = this;
    
    function validateKeyExists(key) {
        var definition = pimpl.getEntityDefinition();
        var fieldDefinition = definition.fields[key];
        if (!fieldDefinition)
            throw new errors.BackerError('Unknown key `' + key + '` on entity `' + definition.name + '`');
    }
    
    // this._applySetRelation = function(onPimpl, fieldDefinition) {
    //     return pimpl._applySetRelation(onPimpl, fieldDefinition);
    // }
    
    this.entityName = function() {
        return pimpl.getEntityDefinition().name;
    }
    
    this.objectId = function() {
        return pimpl.objectId();
    }
    
    this.toJSON = function(user) {
        var definition = pimpl.getEntityDefinition();
        return _.extend({ id: pimpl.objectId() }, _.extend(_.object(_.compact(_.map(definition.fields, function(field) {
            if (field.type.isRelation()) {
                // TODO: relations
            } else {
                var value = pimpl.get(field.name);
                if (!_.isUndefined(value)) {
                    // TODO: check access 
                    
                    if (field.type.isDate()) {
                        value = value.toISOString();
                    } else if (field.type.isFile()) {
                        value = value.toJSON();
                    }
                
                    return [field.name, value];
                }
            }
        }))), {
            createdAt: pimpl.getCreatedAt() ? pimpl.getCreatedAt().toJSON() : undefined,
            updatedAt: pimpl.getCreatedAt() ? pimpl.getUpdatedAt().toJSON() : undefined
        }));
    }
    
    // Returns the current value of the specified key
    this.get = function(key) {
        validateKeyExists(key);
        return pimpl.get(key);
    }
    
    this.getCreatedAt = function() {
        return pimpl.getCreatedAt();
    }
    
    this.getUpdatedAt = function() {
        return pimpl.getUpdatedAt();
    }
    
    // Returns the current value of the specified key
    this.relation = function(key) {
        validateKeyExists(key);
        return pimpl.relation(key);
    }
    
    // Sets value for a specified key
    this.set = function(key, value) {
        validateKeyExists(key);
        return pimpl.set(key, value);
    }
    
    // Returns true if object was never saved to persistent storage
    this.isNew = function() {
        return pimpl.isNew();
    }
    
    // Returns true if object doesn't contain any data
    this.isFetched = function() {
        return pimpl.isFetched();
    }
    
    // Fetches object data from the perstistent storage, discarding any updates made to the object.
    // Returns Backer.Promise
    this.fetch = function() {
        return pimpl.fetch(self);
    }
    
    // Fetches object data from the perstistent storage, discarding any updates made to the object.
    // Returns Backer.Promise
    this.save = function() {
        return pimpl.save(self);
    }
    
    // Returns true if value for the key was changed but was not persisted in the database yet
    this.changed = function(key) {
        validateKeyExists(key);
        return pimpl.changed(key);
    }
    
    // Deletes the object from the resistent storage. Returns Backer.Promise
    this.destroy = function() {
        return pimpl.destroy();
    }
}

module.exports = BackerObject;
