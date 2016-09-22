var _ = require('underscore');
var _nconf = require('nconf');
var Promise = require('./promise/BackeryPromise.js');
var BackeryCondition = require('./model/classes/BackeryCondition.js');
var Struct = require('./api/BackeryStruct.js');
var promise = require('./promise/BackeryPromise.js');
var errors = require('./utils/errors.js');
var parse = require('./utils/parse.js');
var SMTPMailer = require('./mailer/SMTPMailer.js');

var cls = require('continuation-local-storage').getNamespace('io.backery.request.context');

//require('promise/lib/rejection-tracking').enable();

var Backery = module.exports = {
    Promise: promise(cls),
    Context: {
        user: function() {
            return cls.get('user');
        }
    },
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
        },
        
        fetchIncludes: function(objects, includes) {
            if (_.isString(includes)) {
                includes = [includes];
            }
            
            if (!_.isArray(includes)) {
                throw new errors.BackeryInvalidParametersError('Invalid `includes`: expected string or array of strings');
            }
            
            if (!_.isArray(objects)) {
                throw new errors.BackeryInvalidParametersError('Invalid `objects`: expected array of Backery objects');
            }
            
            if (_.uniq(_.map(objects, function(o) { return o.entityName; })).length > 1) {
                throw new errors.BackeryInvalidParametersError('Invalid `objects`: object should all be of the same entity');
            }
            
            if (objects.length == 0)
                return Promise.resolve([]);
            
            var entity = Backery.Model[objects[0].entityName];
            
            return Promise.all(_.map(includes, function(include) {
                if (!entity.getDefinition().fields[include]) {
                    throw new errors.BackeryInvalidParametersError('Included field "' + include + '" not found (entity: "' + entity.getName() + '")');
                }
                
                if (!entity.getDefinition().fields[include].type.isRelationOne()) {
                    throw new errors.BackeryInvalidParametersError('Included field "' + include +
                        '" is not to-one relation (entity: "' + entity.getName() + '")');
                }
                
                var ids = _.uniq(_.compact(_.map(objects, function(object) {
                    return  object.get(include) ? object.get(include).objectId() : undefined;
                })));
                
                return Backery.Model[entity.getDefinition().fields[include].type.relatedEntity.name].query()
                        .where(Backery.In('id', ids)).find().then(function(included) {
                    _.each(objects, function(object) {
                        if (object.get(include) && object.get(include).objectId()) {
                            var found = _.find(included, function(includedObject) {
                                return includedObject.objectId() == object.get(include).objectId();
                            });
                            
                            if (found) {
                                object.set(include, found);
                            }
                        }
                    });
                    
                    return Promise.resolve(objects);
                });
            })).then(function() {
                return Promise.resolve(objects);
            });
        }
    },
    
    Utils: {
        parseDate: parse.parseISODate,
        parseInt: parse.parseInt,
        parseFloat: parse.parseFloat
    },
    
    Push: {
        send: function(whereInstallation, payload, queue) {
            if (_.isString(whereInstallation)) {
                whereInstallation = { $eq: { user: whereInstallation } };
            }
            
            if (_.isFunction(whereInstallation.objectId)) {
                whereInstallation = { $eq: { user: whereInstallation } };
            }
            
            queue.enqueue(whereInstallation, payload);
        }
    },
    
    Mailer: {
        send: function(options) {
            _mailer = new SMTPMailer(_nconf.get('mailer:config'), Backery);
            return _mailer.sendMail(options);
        }
    },
    
    /// Namespace for errors and custom erro
    Error: function(message, code, status) {
        this.status = status;
        this.code = code;
        this.message = message;
        
        this.hasMessageForBackery = true;
    }
};

Backery.Error = _.extend(Backery.Error,
{
    Inconsistency: function(message, code, status) {
        Backery.Error.apply(this, [message, code, status || 422]);
    },
    
    InvalidParameters: function(message) {
        if (_.isArray(message)) {
            if (message.length > 1) {
                message = 'Invalid parameters: ' + message.join(', ');
            } else {
                message = 'Invalid parameter: ' + message[0];
            }
        }
        
        Backery.Error.apply(this, [message, 'InvalidParametersError', 422]);
    },
    
    NotFound: function(what, id) {
        var message;
        if (_.isUndefined(id))
            message = what;
        else
            message = what + ' (id: ' + id + ') not found';
        
        Backery.Error.apply(this, [message, 'NotFoundError', 404]);
    },
    
    Unauthorized: function(message) {
        Backery.Error.apply(message || 'User should be authorized to perform this operation',
            [message, 'UnauthorizedError', 401]);
    }
});

_.each(BackeryCondition, function(value, key) {
    Backery[key] = value;
});
