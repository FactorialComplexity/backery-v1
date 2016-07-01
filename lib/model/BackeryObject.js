var _ = require('underscore');
var errors = require('../utils/errors.js');

var BackeryObject = function(impl, Backery, databaseHooks) {
    //this.isRef = isRef;

    var pimpl = impl;
    var self = this;
    
    function validateKeyExists(key) {
        var definition = pimpl.getEntityDefinition();
        var fieldDefinition = definition.fields[key];
        if (!fieldDefinition)
            throw new errors.BackeryInvalidParametersError('Unknown key `' + key + '` on entity `' + definition.name + '`');
    }
    
    function deserializeVerboseObjectsInArrayOrDictionary(key, value) {
        var definition = pimpl.getEntityDefinition();
        var fieldDefinition = definition.fields[key];

        if (fieldDefinition.type.isArray() || fieldDefinition.type.isDictionary()) {
            return Backery.Struct.deserializeVerboseObjectsInJSON(value, true);
        }
        
        return value;
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
                                struct.set(field.name, Backery.Struct.Object(field.type.relatedEntity.name, null));
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
                        } else if (field.type.isArray()) {
                            struct.set(field.name, Backery.Struct.Array(value));
                        } else if (field.type.isDictionary()) {
                              struct.set(field.name, Backery.Struct.Dictionary(value));
                        } else if (field.type.isLocation()) {
                              struct.set(field.name, Backery.Struct.Location(value));
                        } else if (field.type.isInteger()) {
                            struct.set(field.name, Backery.Struct.Integer(value));
                        } else if (field.type.isBoolean()) {
                            struct.set(field.name, Backery.Struct.Boolean(value));
                        }
                    }
                }
            });

            struct.createdAt = Backery.Struct.Date(pimpl.getCreatedAt());
            struct.updatedAt = Backery.Struct.Date(pimpl.getUpdatedAt());
        }
        databaseHooks.afterStruct(struct);
        return struct;
    }

    this.toJSON = function(options) {
        return this.toStruct(options).toJSON(options && options.verbose);
    }
    
    // Returns the current value of the specified key
    this.get = function(key) {
        validateKeyExists(key);
        return deserializeVerboseObjectsInArrayOrDictionary(key, pimpl.get(key));
    }

    this.getCreatedAt = function() {
        return pimpl.getCreatedAt();
    }

    this.getUpdatedAt = function() {
        return pimpl.getUpdatedAt();
    }

    // Returns the current relation for the specified key
    this.relation = function(key) {
        validateKeyExists(key);
        return pimpl.relation(key, self);
    }

    // Sets value for a specified key
    this.set = function(key, value) {
        var values = {};
        values[key] = value;
        return pimpl.setValues(pimpl.getEntityDefinition().prepareValues(values, Backery));
    }
    
    this.increment = function(key, value) {
        var definition = pimpl.getEntityDefinition();
        var fieldDefinition = definition.fields[key];
        if (!fieldDefinition)
            throw new errors.BackeryInvalidParametersError('Unknown key `' + key + '` on entity `' + definition.name + '`');
        
        if (!fieldDefinition.type.isInteger() && !fieldDefinition.type.isNumber()) {
            throw new errors.BackeryInvalidParametersError('Cannot increment key `' + key + '` on entity `' + definition.name +
                '` (invalid field type)');
        }
        
        return pimpl.increment(key, value);
    }

    // Set multiple values from key/value object
    this.setValues = function(values) {
        var definition = pimpl.getEntityDefinition();
        
        if (Backery.Struct.isStructObject(values)) {
            var struct = values;
            _.each(definition.fields, function(field) {
                var fieldStruct = struct.get(field.name);
                if (fieldStruct) {
                    if (field.type.isRelation()) {
                        if (field.type.isRelationOne()) {
                            if (fieldStruct.isObject()) {
                                // TODO: objects pool
                                self.set(field.name, Backery.Model[field.type.relatedEntity.name].load(fieldStruct));
                            } else {
                                throw new errors.BackeryConsistencyError('Failed to load object from struct: types for `' +
                                    field.name + '` do not match (expected Object, found ' + fieldStruct.type + ')');
                            }
                        } else {
                            // TODO: currently many relations are not being handled in any way
                        }
                    } else {
                        _.find(['Date', 'String', 'Number', 'Integer', 'Boolean', 'Array', 'Dictionary'], function(type) {
                            if (field.type['is' + type]()) {
                                if (fieldStruct['is' + type]()) {
                                    self.set(field.name, fieldStruct.value);
                                    return true;
                                } else {
                                    throw new errors.BackeryConsistencyError('Failed to load object from struct: types for `' +
                                        field.name + '` do not match (expected ' + type + ', found ' + fieldStruct.type + ')');
                                }
                            }
                        });
                    }
                }
            });
        } else {
            var prepared = definition.prepareValues(values, Backery);
            pimpl.setValues(prepared);

            _.map(definition.fields, function(fieldDefinition) {
                if (fieldDefinition.type.isRelationMany() && values[fieldDefinition.name]) {
                    self.relation(fieldDefinition.name).setOperation(prepared[fieldDefinition.name]);
                }
            });
        }
    }

    // Returns true if object doesn't contain any data
    this.isFetched = function() {
        return pimpl.isFetched();
    }

    // Fetches object data from the perstistent storage. Unsaved changes on the instance will NOT be
    // discarded. Returns Backery.Promise.
    this.fetch = function(include) {
        return pimpl.fetch(self, pimpl.getEntityDefinition().prepareInclude(include));
    }
    
    // Fetches object data from the perstistent storage, if the data was never fetched before.
    // Returns Backery.Promise
    this.fetchIfNeeded = function(include) {
        if (self.isRef()) {
            return pimpl.fetch(self, pimpl.getEntityDefinition().prepareInclude(include));
        } else {
            return Backery.Promise.resolve(self);
        }
    }

    // Fetches object data from the perstistent storage, discarding any updates made to the object.
    // Returns Backery.Promise
    this.save = function(options) {
        options = _.defaults(options || {}, {
            bypassHooks: false
        });
        
        try {
            pimpl.getEntityDefinition().validateBeforeSave(self);
        } catch (error) {
            return Backery.Promise.reject(error);
        }
        
        var beforeSave = function(object) {
            if (!options.bypassHooks) {
                return databaseHooks.beforeSave(object);
            } else {
                return Backery.Promise.resolve();
            }
        };
        
        var afterSave = function(object, before) {
            if (!options.bypassHooks) {
                return databaseHooks.afterSave(object, before);
            } else {
                return Backery.Promise.resolve();
            }
        };
        
        var wasChanged, wasNew, wasPrevious, wasGet;
        return beforeSave(self).then(function() {
            wasChanged = { };
            wasPrevious = { };
            wasGet = { };
            wasNew = self.isNew();
            
            _.each(pimpl.getEntityDefinition().fields, function(field) {
                if (self.changed(field.name)) {
                    wasChanged[field.name] = true;
                }
                
                if (!field.type.isRelationMany()) {
                    wasPrevious[field.name] = self.previous(field.name);
                    wasGet[field.name] = self.get(field.name);
                }
            });
            
            return pimpl.save(self);
        }).then(function() {
            return afterSave(self, {
                isNew: function() { return wasNew; },
                changed: function(key) { return wasChanged[key]; },
                isNewOrChanged: function(key) { return wasNew || wasChanged[key]; },
                previous: function(key) { return wasPrevious[key]; },
                get: function(key) { return wasGet[key]; }
            }).then(function() {
                return Backery.Promise.resolve(self);
            });
        });
    }
    
    // Returns true if object was never saved to persistent storage
    this.isNew = function() {
        return pimpl.isNew();
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
    
    this.isNewOrChanged = function(key) {
        return self.isNew() || self.changed(key);
    }
    
    this.previous = function(key) {
        validateKeyExists(key);
        if (self.isFetched()) {
            return deserializeVerboseObjectsInArrayOrDictionary(key, pimpl.previous(key));
        }
    }
    
    this.revert = function(key) {
        validateKeyExists(key);
        
    }
    
    // Deletes the object from the resistent storage. Returns Backery.Promise
    this.destroy = function() {
        return databaseHooks.beforeDestroy(self).then(function() {
            return pimpl.destroy();
        }).then(function() {
            return databaseHooks.afterDestroy(self).then(function() {
                return Backery.Promise.resolve();
            });
        });
    }

    this.isRef = function() {
        return pimpl.isRef();
    }
}

module.exports = BackeryObject;
