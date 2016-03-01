var util = require('util');
var _ = require('underscore');
var errors = require('../utils/errors.js');

var structs = module.exports = {};

var BackeryStruct = function(type) {
    Object.defineProperty(this, 'type', { get: function() { return type; } });
};

function defineSimpleStruct(options) {
    var BackeryStructType = function(value) {
        BackeryStruct.apply(this, [options.type]);
    
        if (options.validate) {
            options.validate(value);
        }
        
        if (options.construct) {
            options.construct(this, value);
        }
        
        if (options.getValue) {
            Object.defineProperty(this, 'value', { get: function() { return options.getValue(); } });
        } else if (!options.excludeValueProperty) {
            Object.defineProperty(this, 'value', { get: function() { return value; } });
        }

        this.toJSON = function(verbose) {
            return options.toJSON(verbose, this);
        }
    }

    util.inherits(BackeryStructType, BackeryStruct);
    structs[options.type] = function(value) {
        return new BackeryStructType(value);
    }
}


// String
defineSimpleStruct({
    type: 'String',

    validate: function(value) {
        if (!_.isString(value) && !_.isNull(value)) {
            throw new errors.BackeryTypeError('Value is not a string');
        }
    },

    toJSON: function(verbose, self) {
        return verbose ? { __type: "String", value: self.value } : self.value;
    }
});


// Number
defineSimpleStruct({
    type: 'Number',

    validate: function(value) {
        if (!_.isNumber(value) && !_.isNull(value)) {
            throw new errors.BackeryTypeError('Value is not a number');
        }
    },

    toJSON: function(verbose, self) {
        return verbose ? { __type: "Number", value: self.value } : self.value;
    }
});


// Integer
defineSimpleStruct({
    type: 'Integer',

    validate: function(value) {
        if (!_.isNumber(value) && !_.isFinite(value) && !_.isNull(value) && !Number.isInteger(value)) {
            throw new errors.BackeryTypeError('Value is not an integer');
        }
    },

    toJSON: function(verbose, self) {
        return verbose ? { __type: "Integer", value: self.value } : self.value;
    }
});


// Boolean
defineSimpleStruct({
    type: 'Boolean',

    validate: function(value) {
        if (!_.isBoolean(value) && !_.isNull(value)) {
            throw new errors.BackeryTypeError('Value is not a boolean');
        }
    },

    toJSON: function(verbose, self) {
        return verbose ? { __type: "Boolean", value: self.value } : self.value;
    }
});

// Date
defineSimpleStruct({
    type: 'Date',

    validate: function(value) {
        if (!_.isDate(value) && !_.isNull(value)) {
            throw new errors.BackeryTypeError('Value is not a Date');
        }
    },

    toJSON: function(verbose, self) {
        return verbose ? { __type: "Date", value: self.value.toJSON() } : self.value.toJSON();
    }
});


// Object
var BackeryStructObject = function(entityName, objectId, isRef) {
    BackeryStruct.apply(this, ['Object']);
    
    var _fields = { };
    var _objectId = objectId;
    
    this.keys = function() {
        return _.keys(_fields);
    }
    
    this.set = function(key, value) {
        if (!_objectId) {
            throw new errors.BackeryConsistencyError('Object is null and cannot have any values attached');
        }
        
        if (!(value instanceof BackeryStruct)) {
            throw new errors.BackeryTypeError('Cannot set value which is not a struct');
        }
        
        _fields[key] = value;
    }
    
    this.get = function(key) {
        return _fields[key];
    }
    
    this.unset = function(key) {
        delete _fields[key];
    }

    this.toJSON = function(verbose) {
        var self = this;
        var json = {
            id: _objectId
        };
        
        if (verbose) {
            json['__type'] = { entity: entityName };
        }
        
        if (!_objectId) {
            if (verbose) {
                json._isNull = true;
            } else {
                return null;
            }
        } else if (isRef) {
            if (verbose) {
                json._isRef = true;
            }
        } else {
            _.each(self.keys(), function(key) {
                json[key] = self.get(key).toJSON(verbose);
            });
        }
        
        return json;
    }
}

util.inherits(BackeryStructObject, BackeryStruct);
structs.Object = function(entityName, objectId, isRef) {
    return new BackeryStructObject(entityName, objectId, isRef);
}


// Collection
var BackeryStructCollection = function(objects, count, offset, limit) {
    BackeryStruct.apply(this, ['Collection']);
    
    var _objects;
    var _count, _offset, _limit;
    
    Object.defineProperty(this, 'objects', { get: function() { return _objects; } });
    
    this.setObjects = function(objects) {
        _.each(objects, function(object) {
            if (!(object instanceof BackeryStructObject)) {
                throw new errors.BackeryTypeError('Only object structs can be appended to the collection');
            }
        });
        
        _objects = objects;
    }
    
    this.append = function(object) {
        if (!(object instanceof BackeryStructObject)) {
            throw new errors.BackeryTypeError('Only object structs can be appended to the collection');
        }
        
        _objects.push(object);
    }
    
    this.setCount = function(count) {
        _count = count;
    }
    
    this.setOffsetLimit = function(offset, limit) {
        _offset = offset;
        _limit = limit;
    }
    
    
    this.setObjects(objects);
    this.setCount(count);
    this.setOffsetLimit(offset, limit);
    
    
    this.toJSON = function(verbose) {
        var self = this;
        
        if (verbose) {
            var json = {
                __type: 'Collection'
            };
            
            json._objects = _.map(_objects, function(object) {
                return object.toJSON(verbose);
            });
            
            if (!_.isUndefined(_count)) {
                json._count = count;
            }
            
            if (!_.isUndefined(_offset)) {
                json._offset = offset;
            }
            
            if (!_.isUndefined(_limit)) {
                json._limit = limit;
            }
            
            return json;
        } else {
            var objects = _.map(_objects, function(object) {
                return object.toJSON(verbose);
            });
            
            if (!_.isUndefined(_count) && _.isUndefined(_objects)) {
                return _count;
            } else if (!_.isUndefined(_count) && !_.isUndefined(_objects)) {
                var json = {
                    _objects: objects,
                    _count: count
                };
                
                if (!_.isUndefined(_offset)) {
                    json._offset = offset;
                }
            
                if (!_.isUndefined(_limit)) {
                    json._limit = limit;
                }
                
                return json;
            } else if (_.isUndefined(_count) && !_.isUndefined(_objects)) {
                return objects;
            }
        }
    }
}

util.inherits(BackeryStructCollection, BackeryStruct);
structs.Collection = function(entityName, objectId) {
    return new BackeryStructCollection(entityName, objectId);
}
