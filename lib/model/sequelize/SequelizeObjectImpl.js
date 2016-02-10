var _ = require('underscore');

var BackeryObject = require('../BackeryObject.js');
var SequelizeNameMapper = require('./SequelizeNameMapper.js');

var BackeryRelation = require('../BackeryRelation.js');
var SequelizeRelationImpl = require('./SequelizeRelationImpl.js');

var errors = require('../../utils/errors.js');

var SequelizeObjectImpl = function(sequelizeInstance, entityDefinition, sequelizeModel, include) {
    this.sequelizeInstance = sequelizeInstance;
    this.entityDefinition = entityDefinition;
    
    this.sequelizeModel = sequelizeModel;
    this.Promise = sequelizeModel.Backery.Promise;
    this.promiseWrap = sequelizeModel.promiseWrap;
    
    this.cachedRelationsOne = { };
    
    var self = this;
    self.relationsMany = _.object(_.compact(_.map(self.entityDefinition.fields, function(fieldDefinition) {
        if (fieldDefinition.type.isRelationMany()) {
            return [fieldDefinition.name, new BackeryRelation(new SequelizeRelationImpl(self, fieldDefinition, self.sequelizeModel), include)];
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
            var sequelizeInstance = this.sequelizeInstance.get(SequelizeNameMapper.sequelizeAssociationAs(fieldDefinition));
            if (sequelizeInstance) {
                return new BackeryObject(new SequelizeObjectImpl(
                    this.sequelizeInstance.get(SequelizeNameMapper.sequelizeAssociationAs(fieldDefinition)),
                    this.entityDefinition, this.sequelizeModel), this.sequelizeModel.Backery);
            } else {
                return sequelizeInstance;
            }
        }
    } else if (fieldDefinition.type.isRelationMany()) {
        throw new errors.BackeryTypeError('Field `' + key + '` is a many relation field. Obtain the relation with relation() instead of get().');
    }
    
    return this.sequelizeInstance.get(key);
}

SequelizeObjectImpl.prototype.relation = function(key) {
    var fieldDefinition = this.entityDefinition.fields[key];
    if (fieldDefinition.type.isRelationMany()) {
        return this.relationsMany[key];
    } else {
        throw new errors.BackeryTypeError('Field `' + key + '` is not a many relation field. Obtain the value with get().');
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
        
        if (_.isNull(value) || value.entityName() == fieldDefinition.type.relatedEntity.name) {
            
            if (!value) {
                self.sequelizeInstance['set' +
                    SequelizeNameMapper.sequelizeAssociationAs(fieldDefinition)](null, { save: false });
                self.cachedRelationsOne[key] = value;
            } else if (value.objectId()) {
                self.sequelizeInstance['set' +
                    SequelizeNameMapper.sequelizeAssociationAs(fieldDefinition)](parseInt(value.objectId()), { save: false });
            
                self.cachedRelationsOne[key] = value;
            } else {
                throw new errors.errors.BackeryConsistencyError('Object should be saved before setting');
            }
        } else {
            throw new errors.errors.BackeryConsistencyError('Invalid referenced type, expected `' + fieldDefinition.type.relatedEntity.name +
                '`, got `' + value.entityName() + '`');
        }
        
        //return value._applySetRelation(self, fieldDefinition);
    } else {
        self.sequelizeInstance.set(key, value);
    }
}

SequelizeObjectImpl.prototype.setValues = function(values) {
    var self = this;
    _.each(values, function(value, key) {
        self.set(key, value);
    });
}

SequelizeObjectImpl.prototype.getAllEntities = function() {
    return this.sequelizeModel.entities;
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
    
    // For complex saves, which include modifying "many relation" fields, we need
    // transaction to rollback if things go wrong at any point
    var transactionWrapRequired = _.find(self.entityDefinition.fields, function(field) {
        return field.type.isRelationMany() && object.relation(field.name).getOperation();
    });
    
    function _do(transaction) {
        return self.promiseWrap(self.sequelizeInstance.save(transaction ? { transaction: transaction } : undefined), function(sequelizeInstance) {
            if (sequelizeInstance) {
                return object;
            } else {
                return undefined;
            }
        }).then(function(object) {
            var relationsSavePromises = [];
            _.each(self.entityDefinition.fields, function(field) {
                if (field.type.isRelationMany() && object.relation(field.name).getOperation()) {
                    relationsSavePromises.push(object.relation(field.name).applyOperation(transaction));
                }
            });
        
            return self.Promise.all(relationsSavePromises);
        }).then(function() {
            return self.Promise.resolve(object);
        });
    }
    
    if (transactionWrapRequired) {
        return self.sequelizeInstance.sequelize.transaction(function(transaction) {
            return _do(transaction);
        });
    } else {
        return _do();
    }
}

SequelizeObjectImpl.prototype.changed = function(key) {
    return this.sequelizeInstance.changed(key)
}

SequelizeObjectImpl.prototype.destroy = function() {
    return this.promiseWrap(this.sequelizeInstance.destroy());
}

module.exports = SequelizeObjectImpl;
