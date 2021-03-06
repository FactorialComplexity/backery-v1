var _ = require('underscore');
var crypto = require('crypto');

var SequelizeNameMapper = require('./SequelizeNameMapper.js');

var BackeryRelation = require('../BackeryRelation.js');
var SequelizeRelationImpl = require('./SequelizeRelationImpl.js');

var errors = require('../../utils/errors.js');

var SequelizeObjectImpl = function(sequelizeInstance, entityDefinition, sequelizeModel, include, isRef, afterFetchCallbackInstaller) {
    this.sequelizeInstance = sequelizeInstance;
    this.entityDefinition = entityDefinition;

    this.sequelizeModel = sequelizeModel;
    this.Promise = sequelizeModel.Backery.Promise;
    this.promiseWrap = sequelizeModel.promiseWrap;

    var self = this;
    var _isFetching;
    
    function _resetRelation() {
        self.relationsOneValues = { };
        self.relationsOnePrevious = { };
    
        self.relationsMany = { };
        self.relationsManyImpl = _.object(_.compact(_.map(self.entityDefinition.fields, function(fieldDefinition) {
            if (fieldDefinition.type.isRelationMany()) {
                var relImpl = new SequelizeRelationImpl(self, fieldDefinition, self.sequelizeModel);
                return [fieldDefinition.name, relImpl];
            }
        })));
    }
    
    _resetRelation();
    
    if (afterFetchCallbackInstaller) {
        // Called when after fetch for this object was completed
        _isFetching = true;
        afterFetchCallbackInstaller(function() {
            _isFetching = false;
        });
        
        self.startAfterFetchCascade(include, afterFetchCallbackInstaller);
    } else {
        // Assume that in this case we do not fetch anything (object is ref or was just created)
        _isFetching = false;
    }
    
    // Functions
    self.isRef = function() {
        return isRef;
    }
    
    self.isFetching = function() {
        return _isFetching;
    }
    
    self.fetch = function(object, include) {
        var self = this;
        var options = { };

        if (include) {
            options.include = self.sequelizeModel.transformInclude(self.getEntityDefinition(), include);
            options.order = self.sequelizeModel.transformSort(self.getEntityDefinition(), undefined, include);
        }
        
        _isFetching = true;
        _resetRelation();
        
        return self.promiseWrap(self.sequelizeInstance.reload(options)).then(function(sequelizeInstance) {
            return self.sequelizeModel.fetchBackeryObject(object, self, include).spread(function(objectAgain) {
                _isFetching = false;
                return self.Promise.resolve(object);
            });
        });
    }
}

SequelizeObjectImpl.prototype.getEntityDefinition = function() {
    return this.entityDefinition;
}

SequelizeObjectImpl.prototype.objectId = function() {
    if (this.sequelizeInstance.get('id'))
        return this.sequelizeInstance.get('id').toString();
    return undefined;
}

SequelizeObjectImpl.prototype.startAfterFetchCascade = function(include, callbackInstaller) {
    var self = this;
    var objectGroups = [];
    
    _.each(self.entityDefinition.fields, function(fieldDefinition) {
        if (fieldDefinition.type.isRelationOne()) {
            var sequelizeInstance = self.sequelizeInstance.get(SequelizeNameMapper.sequelizeAssociationAs(fieldDefinition));
            if (sequelizeInstance) {
                var prepared = self.sequelizeModel.prepareBackeryObjectForFetching(sequelizeInstance,
                    fieldDefinition.type.relatedEntity, [] /*TODO:include*/, callbackInstaller);
                self.relationsOneValues[fieldDefinition.name] = prepared.object;
                
                // Relation-one object is one group
                objectGroups.push({
                    entityDefinition: fieldDefinition.type.relatedEntity,
                    objects: [prepared.object],
                    include: [] // TODO
                });
                
                // Any groups created as a cascade are also added
                objectGroups.push.apply(objectGroups, prepared.impl.getObjectGroupsForCascadeFetch());
                
                self.relationsOnePrevious[fieldDefinition.name] = self.relationsOneValues[fieldDefinition.name] = prepared.object;
            } else {
                var relatedObjectId = self.sequelizeInstance.get(SequelizeNameMapper.sequelizeAssociationForeignKey(fieldDefinition));
                self.relationsOnePrevious[fieldDefinition.name] = self.relationsOneValues[fieldDefinition.name] = !relatedObjectId ? null :
                    self.sequelizeModel.entities[fieldDefinition.type.relatedEntity.name].load(relatedObjectId.toString());
            }
        } else if (fieldDefinition.type.isRelationMany()) {
            var relationImpl = self.relationsManyImpl[fieldDefinition.name];
            relationImpl.reloadFetched([] /*TODO: include*/, callbackInstaller);
            objectGroups.push.apply(objectGroups, relationImpl.getObjectGroupsForCascadeFetch());
        }
    });
    
    self._objectGroupsForCascadeFetch = objectGroups;
}

SequelizeObjectImpl.prototype.getObjectGroupsForCascadeFetch = function() {
    return this._objectGroupsForCascadeFetch;
}

SequelizeObjectImpl.prototype._get = function(functionName, key) {
    var fieldDefinition = this.entityDefinition.fields[key];
    if (fieldDefinition.type.isRelationOne()) {
        if (functionName == 'get') {
            return this.relationsOneValues[key];
        } else {
            return this.relationsOnePrevious[key];
        }
    } else if (fieldDefinition.type.isRelationMany()) {
        throw new errors.BackeryTypeError('Field `' + key + '` is a many relation field. Obtain the relation with relation() instead of ' +
            [functionName] + '().');
    } else if (fieldDefinition.type.isLocation()) {
        var value = this.sequelizeInstance[functionName](key);
        return value ? value.coordinates : value;
    } else if (fieldDefinition.type.isArray() || fieldDefinition.type.isDictionary()) {
        var value = this.sequelizeInstance[functionName](key);
        if (_.isString(value))
            return JSON.parse(value);
        return value;
    }

    return this.sequelizeInstance[functionName](key);
}

SequelizeObjectImpl.prototype.get = function(key) {
    return this._get('get', key);
}

SequelizeObjectImpl.prototype.previous = function(key) {
    return this._get('previous', key);
}

SequelizeObjectImpl.prototype.relation = function(key, sourceObject) {
    var fieldDefinition = this.entityDefinition.fields[key];
    if (fieldDefinition.type.isRelationMany()) {
        if (!this.relationsMany[key]) {
            this.relationsMany[key] = new BackeryRelation(this.relationsManyImpl[key], sourceObject);
        }
        
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

    if (fieldDefinition.type.isRelationOne()) {
        if (_.isNull(value) || value.entityName == fieldDefinition.type.relatedEntity.name) {
            if (!value) {
                self.sequelizeInstance['set' +
                    SequelizeNameMapper.sequelizeAssociationAs(fieldDefinition)](null, { save: false });
                self.relationsOneValues[key] = value;
            } else if (value.objectId()) {
                self.sequelizeInstance['set' +
                    SequelizeNameMapper.sequelizeAssociationAs(fieldDefinition)](parseInt(value.objectId()), { save: false });
                self.relationsOneValues[key] = value;
            } else {
                throw new errors.errors.BackeryConsistencyError('Object should be saved before setting');
            }
        } else {
            throw new errors.errors.BackeryConsistencyError('Invalid referenced type, expected `' + fieldDefinition.type.relatedEntity.name +
                '`, got `' + value.entityName + '`');
        }
        //return value._applySetRelation(self, fieldDefinition);
    } else if (fieldDefinition.type.isLocation() && value) {
        self.sequelizeInstance.set(key, { type: 'Point', coordinates: value });
    } else if (fieldDefinition.type.isArray() || fieldDefinition.type.isDictionary()) {
        self.sequelizeInstance.set(key, JSON.stringify(value));
    } else {
        self.sequelizeInstance.set(key, value);
    }
}

SequelizeObjectImpl.prototype.increment = function(key, value) {
    return this.promiseWrap(this.sequelizeInstance.increment(key, { by: _.isUndefined(value) ? 1 : value }));
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
    return !this.isRef();
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
                    relationsSavePromises.push(self.relationsManyImpl[field.name].applyOperation(object.relation(field.name).getOperation(), transaction).then(function() {
                        self.relationsMany[field.name].setOperation(undefined);
                    }));
                }
            });

            return self.Promise.all(relationsSavePromises);
        }).then(function() {
            if (self.isFetched()) {
                // When saving newly created object, we will not auto set null values for one-relations
                // TODO: check what happens if Object is being saved, if it is nether new, nor fetched
                _.each(self.entityDefinition.fields, function(field) {
                    if (field.type.isRelationOne() && !self.relationsOneValues[field.name]) {
                        self.relationsOneValues[field.name] = null;
                    }
                });
            }
            
            self.relationsOnePrevious = _.clone(self.relationsOneValues);
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
    var fieldDefinition = this.entityDefinition.fields[key];
    if (fieldDefinition.type.isRelationOne()) {
        return this.sequelizeInstance.changed(SequelizeNameMapper.sequelizeAssociationForeignKey(fieldDefinition));
    }
    
    return this.sequelizeInstance.changed(key);
}

SequelizeObjectImpl.prototype.destroy = function() {
    return this.promiseWrap(this.sequelizeInstance.destroy());
}

// User special methods
SequelizeObjectImpl.prototype._generateSalt = function() {
    var buffer = crypto.randomBytes(256);
    return crypto.createHash('sha1').update(buffer).digest('hex');
}

SequelizeObjectImpl.prototype._generateRecoveryToken = function() {
    var buffer = crypto.randomBytes(256);
    return crypto.createHash('sha1').update(buffer).digest('hex');
}

SequelizeObjectImpl.prototype._encryptPassword = function(password, salt) {
    var md5sum = crypto.createHash('md5');
    md5sum.update(password);
    md5sum.update(salt);
    return md5sum.digest('hex');
}

SequelizeObjectImpl.prototype.User_isPasswordSet = function() {
    if (this.isRef()) {
        if (this.sequelizeInstance.get('__password'))
            return true;
        else
            return undefined;
    }

    return !!this.sequelizeInstance.get('__password');
}

SequelizeObjectImpl.prototype.User_setPassword = function(password) {
    var salt = this._generateSalt();
    this.sequelizeInstance.set('__salt', salt);
    this.sequelizeInstance.set('__password', this._encryptPassword(password, salt));
    this.sequelizeInstance.set('__passwordRecoveryToken', null);
    this.sequelizeInstance.set('__passwordRecoveryTokenExpiresAt', null);
}

SequelizeObjectImpl.prototype.User_isPasswordCorrect = function(password) {
    return this._encryptPassword(password, this.sequelizeInstance.get('__salt')) ==
        this.sequelizeInstance.get('__password');
}

SequelizeObjectImpl.prototype.User_setFacebookUserId = function(facebookUserId) {
    this.sequelizeInstance.set('__facebookUserId', facebookUserId);
}

SequelizeObjectImpl.prototype.User_getFacebookUserId = function() {
    return this.sequelizeInstance.get('__facebookUserId');
}

SequelizeObjectImpl.prototype.User_setTwitterUserId = function(facebookUserId) {
    this.sequelizeInstance.set('__twitterUserId', facebookUserId);
}

SequelizeObjectImpl.prototype.User_getTwitterUserId = function() {
    return this.sequelizeInstance.get('__twitterUserId');
}

SequelizeObjectImpl.prototype.User_setGoogleUserId = function(googleUserId) {
    this.sequelizeInstance.set('__googleUserId', googleUserId);
}

SequelizeObjectImpl.prototype.User_getGoogleUserId = function() {
    return this.sequelizeInstance.get('__googleUserId');
}

SequelizeObjectImpl.prototype.User_resetPasswordRecoveryToken = function() {
    var id = this.objectId();
    if (!id) {
        return this.Promise.reject(new errors.BackeryConsistencyError(
            'Cannot reset password recovery token, ' +
            'because User object was not saved to database'));
    }
    
    var update = this.sequelizeInstance.Model.build({ id: parseInt(id) }, { isNewRecord : false });
    var token = this._generateRecoveryToken();
    update.set('__passwordRecoveryToken', token);
    update.set('__passwordRecoveryTokenExpiresAt', new Date(new Date().getTime() + 60 * 60 * 1000));
    
    return this.promiseWrap(update.save(), function(res) {
        return token;
    });
}

SequelizeObjectImpl.prototype.User_isPasswordRecoveryTokenValid = function(token) {
    return (token && this.sequelizeInstance.get('__passwordRecoveryToken') == token &&
        this.sequelizeInstance.get('__passwordRecoveryTokenExpiresAt') > new Date());
}

SequelizeObjectImpl.prototype.User_getRoles = function() {
    var self = this;
    return _.compact(_.map(this.entityDefinition.modelDefinition.roles, function(role) {
        if (!role.isVirtual()) {
            if (self.sequelizeInstance.get('__role_' + role.name)) {
                return role;
            }
        }
    }));
}

SequelizeObjectImpl.prototype.User_hasRole = function(role) {
    return !!this.sequelizeInstance.get('__role_' + role.name);
}

SequelizeObjectImpl.prototype.User_addRole = function(role) {
    return !!this.sequelizeInstance.set('__role_' + role.name, true);
}

SequelizeObjectImpl.prototype.User_removeRole = function(role) {
    return !!this.sequelizeInstance.set('__role_' + role.name, false);
}

SequelizeObjectImpl.prototype.File_getManager = function() {
    if (!this.sequelizeInstance.get('__storageType'))
        return this.sequelizeModel.getDefaultFileManager();
    return this.sequelizeModel.getFileManager(this.sequelizeInstance.get('__storageType'));
}

SequelizeObjectImpl.prototype.File_setStorageType = function(fileManager) {
    return this.sequelizeInstance.set('__storageType', fileManager);
}

SequelizeObjectImpl.prototype.File_setStorage = function(storage) {
    return this.sequelizeInstance.set('__storage', JSON.stringify(storage));
}

SequelizeObjectImpl.prototype.File_setContentType = function(contentType) {
    return this.sequelizeInstance.set('__contentType', contentType);
}

SequelizeObjectImpl.prototype.File_setSize = function(size) {
    return this.sequelizeInstance.set('__size', size);
}

SequelizeObjectImpl.prototype.File_getStorage = function() {
    return JSON.parse(this.sequelizeInstance.get('__storage'));
}

SequelizeObjectImpl.prototype.File_getContentType = function() {
    return this.sequelizeInstance.get('__contentType');
}

SequelizeObjectImpl.prototype.File_getSize = function() {
    return this.sequelizeInstance.get('__size');
}

module.exports = SequelizeObjectImpl;
