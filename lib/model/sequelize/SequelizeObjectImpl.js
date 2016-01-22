var BackerObject = require('../BackerObject.js');
var SequelizeNameMapper = require('./SequelizeNameMapper.js');

var errors = require('../utils/errors.js');

var SequelizeObjectImpl = function(sequelizeInstance, entityDefinition, context) {
    this.sequelizeInstance = sequelizeInstance;
    this.entityDefinition = entityDefinition;
    
    this.context = context;
    this.Promise = context.Promise;
    this.promiseWrap = context.promiseWrap;
    this.model = context.model;
    
    this.cachedRelationsOne = { };
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
    }
    
    return this.sequelizeInstance.get(key);
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
                var valueSequelizeInstance = self.model._sequelizeModels[value.entityName()].build({ id: parseInt(value.objectId()) }, { isNewRecord: false });
                self.promiseWrap(self.sequelizeInstance['set' +
                        SequelizeNameMapper.sequelizeAssociationAs(fieldDefinition)](valueSequelizeInstance, { save: false }));
            
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

SequelizeObjectImpl.prototype.isNew = function() {
    return this.sequelizeInstance.isNewRecord;
}

SequelizeObjectImpl.prototype.isFetched = function() {
    return true; // TODO
}

SequelizeObjectImpl.prototype.fetch = function() {
    var self = this;
    return self.promiseWrap(self.sequelizeInstance.reload(), function(sequelizeInstance) {
        if (sequelizeInstance) {
            return self;
        } else {
            return undefined;
        }
    });
}

SequelizeObjectImpl.prototype.save = function() {
    var self = this;
    return self.promiseWrap(self.sequelizeInstance.save(), function(sequelizeInstance) {
        if (sequelizeInstance) {
            return self;
        } else {
            return undefined;
        }
    });
}

SequelizeObjectImpl.prototype.changed = function(key) {
    return this.sequelizeInstance.changed(key)
}

SequelizeObjectImpl.prototype.destroy = function() {
    return this.promiseWrap(this.sequelizeInstance.destroy());
}

module.exports = SequelizeObjectImpl;
