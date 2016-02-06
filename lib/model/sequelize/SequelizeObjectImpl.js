var _ = require('underscore');

var BackerObject = require('../BackerObject.js');
var SequelizeNameMapper = require('./SequelizeNameMapper.js');

var BackerRelation = require('../BackerRelation.js');
var SequelizeRelationImpl = require('./SequelizeRelationImpl.js');

var errors = require('../../utils/errors.js');

var SequelizeObjectImpl = function(sequelizeInstance, entityDefinition, context) {
    this.sequelizeInstance = sequelizeInstance;
    this.entityDefinition = entityDefinition;
    
    this.context = context;
    this.Promise = context.Promise;
    this.promiseWrap = context.promiseWrap;
    this.model = context.model;
    
    this.cachedRelationsOne = { };
    
    var self = this;
    self.relationsMany = _.object(_.compact(_.map(self.entityDefinition.fields, function(fieldDefinition) {
        if (fieldDefinition.type.isRelationMany()) {
            return [fieldDefinition.name, new BackerRelation(new SequelizeRelationImpl(self, fieldDefinition,
                _.extend(self.context, { SequelizeObjectImpl: SequelizeObjectImpl })))];
        }
    })));
}

SequelizeObjectImpl.prototype.getEntityDefinition = function() {
    return this.entityDefinition;
}

SequelizeObjectImpl.prototype.objectId = function() {
    return this.sequelizeInstance.get('id').toString();
}

SequelizeObjectImpl.prototype.get = function(key) {
    // TODO: handling of special type fields
    var fieldDefinition = this.entityDefinition.fields[key];
    if (fieldDefinition.type.isRelationOne()) {
        if (this.cachedRelationsOne[key]) {
            return this.cachedRelationsOne[key];
        } else {
            return new BackerObject(new SequelizeObjectImpl(
                this.sequelizeInstance.get(SequelizeNameMapper.sequelizeAssociationAs(fieldDefinition)),
                this.entityDefinition, this.context));
        }
    } else if (fieldDefinition.type.isRelationMany()) {
        throw new errors.BackerTypeError('Field `' + key + '` is a many relation field. Obtain the relation with relation() instead of get().');
    }
    
    return this.sequelizeInstance.get(key);
}

SequelizeObjectImpl.prototype.relation = function(key) {
    var fieldDefinition = this.entityDefinition.fields[key];
    if (fieldDefinition.type.isRelationMany()) {
        return this.relationsMany[key];
    } else {
        throw new errors.BackerTypeError('Field `' + key + '` is not a many relation field. Obtain the value with get().');
    }
}

SequelizeObjectImpl.prototype.getCreatedAt = function() {
    return this.sequelizeInstance.get('createdAt');
}

SequelizeObjectImpl.prototype.getUpdatedAt = function() {
    return this.sequelizeInstance.get('updatedAt');
}

// SequelizeObjectImpl.prototype._applySetRelation = function(onPimpl, fieldDefinition) {
//     var self = this;
//     return self.promiseWrap(onPimpl.sequelizeInstance['set' +
//         SequelizeNameMapper.sequelizeAssociationAs(fieldDefinition)](self.sequelizeInstance, { save: false }));
// }

SequelizeObjectImpl.prototype.set = function(key, value) {
    var self = this;
    var fieldDefinition = self.entityDefinition.fields[key];
    
    // TODO: handling of special type fields
    if (fieldDefinition.type.isRelationOne()) {
        
        if (value.entityName() == fieldDefinition.type.relatedEntity.name) {
            
            if (value.objectId()) {
                self.promiseWrap(self.sequelizeInstance['set' +
                        SequelizeNameMapper.sequelizeAssociationAs(fieldDefinition)](parseInt(value.objectId()), { save: false }));
            
                self.cachedRelationsOne[key] = value;
            } else {
                throw new errors.errors.BackerConsistencyError('Object should be saved before setting');
            }
        } else {
            throw new errors.errors.BackerConsistencyError('Invalid referenced type, expected `' + fieldDefinition.type.relatedEntity.name +
                '`, got `' + value.entityName() + '`');
        }
        
        //return value._applySetRelation(self, fieldDefinition);
    } else {
        self.sequelizeInstance.set(key, value);
    }
}

SequelizeObjectImpl.prototype.setValues = function(values) {
    var self = this;
    self.sequelizeInstance.set(values);
}

SequelizeObjectImpl.prototype.getAllEntities = function() {
    return this.context.model.entities;
}

SequelizeObjectImpl.prototype.isNew = function() {
    return this.sequelizeInstance.isNewRecord;
}

SequelizeObjectImpl.prototype.isFetched = function() {
    return true; // TODO
}

SequelizeObjectImpl.prototype.fetch = function(object) {
    var self = this;
    return self.promiseWrap(self.sequelizeInstance.reload(), function(sequelizeInstance) {
        if (sequelizeInstance) {
            return object;
        } else {
            return undefined;
        }
    });
}

SequelizeObjectImpl.prototype.save = function(object) {
    var self = this;
    return self.promiseWrap(self.sequelizeInstance.save(), function(sequelizeInstance) {
        if (sequelizeInstance) {
            return object;
        } else {
            return undefined;
        }
    }).then(function(object) {
        var relationsSavePromises = [];
        _.each(self.entityDefinition.fields, function(field) {
            if (field.type.isRelationMany() && object.relation(field.name).getOperation()) {
                relationsSavePromises.push(object.relation(field.name).applyOperation());
            }
        });
        
        return self.Promise.all(relationsSavePromises);
    }).then(function() {
        return self.Promise.resolve(object);
    });
}

SequelizeObjectImpl.prototype.changed = function(key) {
    return this.sequelizeInstance.changed(key)
}

SequelizeObjectImpl.prototype.destroy = function() {
    return this.promiseWrap(this.sequelizeInstance.destroy());
}

module.exports = SequelizeObjectImpl;
