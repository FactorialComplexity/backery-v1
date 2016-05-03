var _ = require('underscore');
var Promise = require('promise');
var BackeryCondition = require('./model/classes/BackeryCondition.js');
var Struct = require('./api/BackeryStruct.js');
var Promise = require('promise');
var errors = require('./utils/errors.js');
var parse = require('./utils/parse.js');

require('promise/lib/rejection-tracking').enable();

var Backery = module.exports = {
    Promise: Promise,
    Struct: Struct,
    Object: {
        load: function(data, model) {
            var struct;
            if (_.isObject(data['__type']) && _.isString(data['__type']['entity']) && !data['__type']['isCollection']) {
                // load from JSON
                struct = Struct.fromJSON(data);
            } else if (Struct.isStructObject(data)) {
                // load from Backery.Struct
                struct = data;
            } else {
                throw new errors.BackeryInvalidParametersError('Failed to load object: no supported parameters found');
            }
            
            var entity = model.entity(struct.entityName);
            if (!entity) {
                throw new errors.BackeryConsistencyError('Failed to load object: entity `' + struct.entityName + '` not found');
            }
            
            return entity.load(struct);
        }
    },
    
    Utils: {
        parseDate: parse.parseISODate,
        parseInt: parse.parseInt,
        parseFloat: parse.parseFloat
    },
    
    /// Namespace for errors and custom erro
    Error: function(message, code, status) {
        Object.defineProperty(this, 'name', { get: function() { return 'BackeryCustomError'; } });
        Object.defineProperty(this, 'status', { get: function() { return status; } });
        Object.defineProperty(this, 'code', { get: function() { return code; } });
        Object.defineProperty(this, 'message', { get: function() {
            return message;
        }});
    }
};

Backery.Error = _.extend(Backery.Error,
{
    Inconsistency: function(message, code, status) {
        Object.defineProperty(this, 'name', { get: function() { return 'BackeryConsistencyError'; } });
        Object.defineProperty(this, 'status', { get: function() { return status ? status : 422; } });
        Object.defineProperty(this, 'code', { get: function() { return code; } });
        Object.defineProperty(this, 'message', { get: function() {
            return message;
        }});
    },
    
    InvalidParameters: function(message) {
        Object.defineProperty(this, 'name', { get: function() { return 'BackeryInvalidParametersError'; } });
        Object.defineProperty(this, 'status', { get: function() { return 422; } });
        Object.defineProperty(this, 'message', { get: function() {
            if (_.isArray(message)) {
                if (message.length > 1) {
                    return 'Invalid parameters: ' + message.join(', ');
                } else {
                    return 'Invalid parameter: ' + message[0];
                }
            } else {
                return message;
            }
        }});
    },
    
    NotFound: function(what, id) {
        Object.defineProperty(this, 'name', { get: function() { return 'BackeryNotFoundError'; } });
        Object.defineProperty(this, 'status', { get: function() { return 404; } });
        Object.defineProperty(this, 'message', { get: function() {
            if (_.isUndefined(id))
                return what;
            else
                return what + ' (id: ' + id + ') not found';
        }});
    }
});

_.each(BackeryCondition, function(value, key) {
    Backery[key] = value;
});
