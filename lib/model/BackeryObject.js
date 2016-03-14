var _ = require('underscore');
var errors = require('../utils/errors.js');

var BackeryObject = function(impl, Backery) {
    //this.isRef = isRef;
    
    var pimpl = impl;
    var self = this;
    
    function validateKeyExists(key) {
        var definition = pimpl.getEntityDefinition();
        var fieldDefinition = definition.fields[key];
        if (!fieldDefinition)
            throw new errors.BackeryError('Unknown key `' + key + '` on entity `' + definition.name + '`');
    }
    
    // this._applySetRelation = function(onPimpl, fieldDefinition) {
    //     return pimpl._applySetRelation(onPimpl, fieldDefinition);
    // }
    
    Object.defineProperty(this, 'entityName', { get: function() { return pimpl.getEntityDefinition().name; } });
    
    this.objectId = function() {
        return pimpl.objectId();
    }
    
    this.toStruct = function(options) {
        var struct = Backery.Struct.Object(this.entityName, pimpl.objectId(), this.isRef());
        
        var definition = pimpl.getEntityDefinition();
        
        var preparedInclude = options && _.isArray(options.include) ?
            pimpl.getEntityDefinition().prepareInclude(options.include) : undefined;
        var shouldInclude = options && _.isBoolean(options.include) ?
            options.include : true;
        
        if (!self.isRef()) {
            _.each(definition.fields, function(field) {
                if (field.type.isRelation()) {
                    var includeField = shouldInclude && (!preparedInclude || _.find(preparedInclude, function(inc) { inc.field == field.name; }));

                    if (includeField) {
                        if (field.type.isRelationMany()) {
                            var relation = self.relation(field.name);
                            struct.set(field.name, Backery.Struct.Collection(field.type.relatedEntity.name,
                                relation.fetched() ? _.map(relation.fetched(), function(object) {
                                    return object.toStruct();
                                }) : undefined, undefined, relation.offset(), relation.limit()));
                        } else if (field.type.isRelationOne()) {
                            var result = pimpl.get(field.name);
                            if (result) {
                                struct.set(field.name, result.toStruct(options));
                            } else if (_.isNull(result)) {
                                struct.set(field.name, Backery.Struct.Object(field.type.relatedEntity.name));
                            }
                        }
                    }
                } else {
                    var value = pimpl.get(field.name);
                    if (!_.isUndefined(value)) {
                        if (field.type.isDate()) {
                            struct.set(field.name, Backery.Struct.Date(value));
                        } else if (field.type.isString()) {
                            struct.set(field.name, Backery.Struct.String(value));
                        } else if (field.type.isNumber()) {
                            struct.set(field.name, Backery.Struct.Number(value));
                        } else if (field.type.isInteger()) {
                            struct.set(field.name, Backery.Struct.Integer(value));
                        } else if (field.type.isBoolean()) {
                            struct.set(field.name, Backery.Struct.Boolean(value));
                        }
                    }
                }
            });
        
            struct.set('createdAt', Backery.Struct.Date(pimpl.getCreatedAt()));
            struct.set('updatedAt', Backery.Struct.Date(pimpl.getUpdatedAt()));
        }

        return struct;
    }
    
    this.toJSON = function(options) {
        return this.toStruct(options).toJSON(options && options.verbose);
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
        var values = {};
        values[key] = value;
        return pimpl.setValues(values);
    }
    
    // Set multiple values from key/value object
    this.setValues = function(values) {
        var definition = pimpl.getEntityDefinition();
        var prepared = definition.prepareValues(values, pimpl.getAllEntities());
        var object = pimpl.setValues(prepared);
        
        _.map(definition.fields, function(fieldDefinition) {
            if (fieldDefinition.type.isRelationMany() && values[fieldDefinition.name]) {
                self.relation(fieldDefinition.name).setOperation(prepared[fieldDefinition.name]);
            }
        });
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
    // Returns Backery.Promise
    this.fetch = function(include) {
        return pimpl.fetch(self, pimpl.getEntityDefinition().prepareInclude(include));
    }
    
    // Fetches object data from the perstistent storage, discarding any updates made to the object.
    // Returns Backery.Promise
    this.save = function() {
        try {
            pimpl.getEntityDefinition().validateBeforeSave(self);
        } catch (error) {
            return Backery.Promise.reject(error);
        }
        
        return pimpl.save(self);
    }
    
    // Returns true if value for the key was changed but was not persisted in the database yet
    this.changed = function(key) {
        validateKeyExists(key);
        var definition = pimpl.getEntityDefinition();

        if (definition.fields[key].type.isRelationMany()) {
            return self.relation(key).getOperation() && !self.relation(key).getOperation().isEmpty();
        }

        return pimpl.changed(key);
    }
    
    // Deletes the object from the resistent storage. Returns Backery.Promise
    this.destroy = function() {
        return pimpl.destroy();
    }
    
    this.isRef = function() {
        return pimpl.isRef();
    }
}

module.exports = BackeryObject;
