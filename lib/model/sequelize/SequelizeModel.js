var Sequelize = require('sequelize');
var crypto = require('crypto');
var _ = require('underscore');
var errors = require('../../utils/errors.js');

var AuthMethodDefinition = require('../definition/AuthMethodDefinition.js');
var TypeDefinition = require('../definition/TypeDefinition.js');

var BackeryEntity = require('../BackeryEntity.js');
var BackeryObject = require('../BackeryObject.js');
var SequelizeEntityImpl = require('./SequelizeEntityImpl.js');
var SequelizeObjectImpl = require('./SequelizeObjectImpl.js');

var SequelizeNameMapper = require('./SequelizeNameMapper.js');

var SequelizeModel = function() {
    
}

SequelizeModel.prototype.define = function(definition, databaseURI, databaseOptions, Backery) {
    var self = this;
    
    self.Backery = Backery;
    
    self._definition = definition;
    
    self._Promise = Backery.Promise;
    self._promiseWrap = function(sequelizePromise, transformResult) {
        return new Promise(function(resolve, reject) {
            sequelizePromise.then(function(res) {
                resolve(transformResult ? transformResult(res) : res);
            }).catch(function(error) {
                var reason = undefined;
                if (error.name == 'SequelizeForeignKeyConstraintError') {
                    reason = 'BackeryObjectsNotFound';
                }
                                
                reject(new errors.BackeryDatabaseError(error, reason));
            });
        });
    }
    
    self.transformInclude = function(entityDefinition, include) {
        return _.map(include || [], function(include) {
            if (entityDefinition.fields[include.field].type.value == TypeDefinition.Relation_One) {
                return {
                    model: self._sequelizeModels[entityDefinition.fields[include.field].type.relatedEntity.name],
                    as: SequelizeNameMapper.sequelizeAssociationAs(entityDefinition.fields[include])
                };
            } else if (entityDefinition.fields[include.field].type.value == TypeDefinition.Relation_Many) {
                return {
                    model: self._sequelizeModels[entityDefinition.fields[include.field].type.relatedEntity.name],
                    as: SequelizeNameMapper.sequelizeAssociationAs(entityDefinition.fields[include.field]),
                    offset: include.offset,
                    limit: include.limit
                };
            }
        });
    }
    
    
    self._sequelize = new Sequelize(databaseURI, _.extend(databaseOptions, {
        logging: function(str) {
        }
    }));
    
    self._sequelizeModels = { };
    self.entities = { };
    
    // Simple fields
    _.each(definition.entities, function(entity, name) {
        var dbFields = { };
        var loginFields = [];
        
        if (entity.isUserEntity()) {
            _.each(definition.authMethods, function(authMethod) {
                if (authMethod.method == AuthMethodDefinition.Password) {
                    dbFields['__password'] = Sequelize.STRING(32);
                    dbFields['__salt'] = Sequelize.STRING;
                    
                    loginFields = authMethod.loginFields;
                } else if (authMethod.method == AuthMethodDefinition.Facebook) {
                    dbFields['__facebookUserId'] = { type: Sequelize.STRING, unique: true };
                }
            });
        }
        
        _.each(entity.fields, function(field) {
            var dbType;
            if (field.type.value == TypeDefinition.String) {
                dbFields[SequelizeNameMapper.sequelizeFieldName(field)] = { type: Sequelize.STRING };
                
                if (_.contains(loginFields, field)) {
                    dbFields[SequelizeNameMapper.sequelizeFieldName(field)].unique = true;
                }
            } else if (field.type.value == TypeDefinition.Integer) {
                dbFields[SequelizeNameMapper.sequelizeFieldName(field)] = { type: Sequelize.INTEGER };
            } else if (field.type.value == TypeDefinition.Number) {
                dbFields[SequelizeNameMapper.sequelizeFieldName(field)] = { type: Sequelize.DOUBLE };
            } else if (field.type.value == TypeDefinition.Boolean) {
                dbFields[SequelizeNameMapper.sequelizeFieldName(field)] = { type: Sequelize.BOOLEAN };
            } else if (field.type.value == TypeDefinition.Array) {
                dbFields[SequelizeNameMapper.sequelizeFieldName(field)] = { type: Sequelize.STRING };
            } else if (field.type.value == TypeDefinition.Object) {
                dbFields[SequelizeNameMapper.sequelizeFieldName(field)] = { type: Sequelize.STRING };
            } else if (field.type.value == TypeDefinition.File) {
                dbFields[SequelizeNameMapper.sequelizeFieldName(field)] = { type: Sequelize.STRING };
            } else if (!field.type.isRelation()) {
                throw new errors.BackerError('Unknown type');
            }
        });
        
        self._sequelizeModels[entity.name] = self._sequelize.define(SequelizeNameMapper.sequelizeModelName(entity), dbFields);
        
        self.entities[entity.name] = new BackeryEntity(self._definition.entities[entity.name],
            new SequelizeEntityImpl(self._definition.entities[entity.name], self._sequelizeModels[entity.name], {
                model: self,
                Promise: self._Promise,
                promiseWrap: self._promiseWrap
            }));
    });
    
    // Relations
    _.each(definition.entities, function(entity, name) {
        var sequelizeModel = self._sequelizeModels[name];
        var createdRelations = [];
        
        _.each(entity.fields, function(field) {
            if (field.type.isRelation()) {
                if (!field.type.reverse || !_.contains(createdRelations, field.type.reverse)) {
                    // Create relation, unless it was already created
                    var sequelizeAssociatedModel = self._sequelizeModels[field.type.relatedEntity.name];
                    
                    if (field.type.value == TypeDefinition.Relation_One) {
                        // handle one-to-one and many-to-one
                        
                        sequelizeModel.belongsTo(sequelizeAssociatedModel, {
                            as: SequelizeNameMapper.sequelizeAssociationAs(field),
                            foreignKey: SequelizeNameMapper.sequelizeAssociationForeignKey(field)
                        });
                        
                        if (field.type.reverse) {
                            if (field.type.reverse.type.value == TypeDefinition.Relation_Many) {
                                sequelizeAssociatedModel.hasMany(sequelizeModel, {
                                    as: SequelizeNameMapper.sequelizeAssociationAs(field.type.reverse),
                                    foreignKey: SequelizeNameMapper.sequelizeAssociationForeignKey(field)
                                });
                            } else {
                                throw new errors.BackerError('Reverse is not supported for one-to-one relations (' +
                                    entity.name + '.' + field.name + ' -> ' + 
                                    field.type.relatedEntity.name + '.' + field.type.reverse.name + ')');
                            }
                        }
                    } else if (field.type.value == TypeDefinition.Relation_Many) {
                        // handle many-to-many
                        
                        if (!field.type.reverse || field.type.reverse.type.value == TypeDefinition.Relation_Many) {
                            
                            var matchTableName = SequelizeNameMapper.sequelizeAssociationThrough(entity, field);
                            
                            sequelizeModel.belongsToMany(sequelizeAssociatedModel, {
                                as: SequelizeNameMapper.sequelizeAssociationAs(field),
                                through: matchTableName
                            });
                            
                            if (field.type.reverse) {
                                sequelizeAssociatedModel.belongsToMany(sequelizeModel, {
                                    as: SequelizeNameMapper.sequelizeAssociationAs(field.type.reverse),
                                    through: matchTableName
                                });
                            }
                        }
                    }
                    
                    createdRelations.push(field);
                }
            }
        });
    });
    
    
    // Auth models
    self.__OAuth_AccessToken = self._sequelize.define('__OAuth_AccessToken', {
        token: { type: Sequelize.STRING, primaryKey: true },
        clientId: Sequelize.STRING,
        expires: Sequelize.DATE
    });
    self.__OAuth_AccessToken.belongsTo(self._sequelizeModels.User);
    
    self.__OAuth_RefreshToken = self._sequelize.define('__OAuth_RefreshToken', {
        token: { type: Sequelize.STRING, primaryKey: true },
        clientId: Sequelize.STRING,
        expires: Sequelize.DATE
    });
    self.__OAuth_RefreshToken.belongsTo(self._sequelizeModels.User);
    
    return self._sequelize.query('SET FOREIGN_KEY_CHECKS = 0').then(function(){
        return self._sequelize.sync(); //{ force: true });
    }).then(function(){
        return self._sequelize.query('SET FOREIGN_KEY_CHECKS = 1')
    });
}

SequelizeModel.prototype._object = function(sequelizeInstance, entityDefinition) {
    if (_.isString(entityDefinition)) {
        entityDefinition = this._definition.entities[entityDefinition];
    }
    
    return new BackeryObject(new SequelizeObjectImpl(sequelizeInstance, entityDefinition, {
        model: this,
        Promise: this._Promise,
        promiseWrap: this._promiseWrap
    }));
}

//
// Public interface
//

SequelizeModel.prototype.getDefinition = function() {
    return this._definition;
}

SequelizeModel.prototype.entity = function(name) {
    return this.entities[name];
}

SequelizeModel.prototype.getAccessToken = function(accessToken) {
    var self = this;
    return new self._Promise(function(resolve, reject) {
        self.__OAuth_AccessToken.findById(accessToken, {
            include: [self._sequelizeModels.User]
        }).then(function(accessToken) {
            resolve({
                expires: accessToken.get('expires'),
                user: {
                    id: accessToken.User.get('id').toString(),
                    object: self._object(accessToken.User, 'User')
                }
            });
        }, function(error) {
            reject(new errors.BackeryDatabaseError(error));
        });
    });
}

SequelizeModel.prototype.saveAccessToken = function(accessToken, clientId, expires, user) {
    var self = this;
    var instance = self.__OAuth_AccessToken.build({
        token: accessToken,
        clientId: clientId,
        expires: expires,
    });
    instance.setUser(parseInt(user.id), { save: false });
    
    return new self._Promise(function(resolve, reject) {
        instance.save().then(function() {
            resolve();
        }, function(error) {
            reject(new errors.BackeryDatabaseError(error));
        });
    });
}

SequelizeModel.prototype.getRefreshToken = function(refreshToken) {
    var self = this;
    return new self._Promise(function(resolve, reject) {
        self.__OAuth_AccessToken.findById(accessToken, {
            include: [self._sequelizeModels.User]
        }).then(function(accessToken) {
            resolve({
                expires: accessToken.get('expires'),
                user: self._object(accessToken.User, 'User')
            });
        }, function(error) {
            reject(new errors.BackeryDatabaseError(error));
        });
    });
}

SequelizeModel.prototype.saveRefreshToken = function(refreshToken, clientId, expires, user) {
    var self = this;
    var instance = self.__OAuth_RefreshToken.build({
        token: refreshToken,
        clientId: clientId,
        expires: expires,
    });
    instance.setUser(parseInt(user.id), { save: false });
    
    return new self._Promise(function(resolve, reject) {
        instance.save().then(function() {
            resolve();
        }, function(error) {
            reject(new errors.BackeryDatabaseError(error));
        });
    });
}

SequelizeModel.prototype._encryptPassword = function(password, salt) {
    var md5sum = crypto.createHash('md5');
    md5sum.update(password);
    md5sum.update(salt);
    return md5sum.digest('hex');
}

SequelizeModel.prototype.authUser = function(method, params) {
    var self = this;
    var methodDefinition = _.find(self._definition.authMethods, function(authMethod) {
        if (method == 'password' && authMethod.method == AuthMethodDefinition.Password) {
            return authMethod;
        }
    });
    
    if (!methodDefinition) {
        throw new errors.BackerConsistencyError('Login/password based authentication method is not supported by the model');
    }
    
    if (method == 'password') {
        var usernameString = params.username;
        var loginField = methodDefinition.loginFields[0];
        var login = usernameString;
        
        if (usernameString.indexOf(':') != -1) {
            var split = usernameString.split(':');
            loginField = _.find(methodDefinition.loginFields, function(field) {
                return field.name == split[0];
            });
            
            if (!loginField) {
                throw new errors.BackerConsistencyError('Invalid login field: `' + split[0] + '`');
            }
            
            login = split[1];
        }
        
        var where = {};
        where[loginField.name] = login;
        
        return new self._Promise(function(resolve, reject) {
            self._sequelizeModels.User.find(where).then(function(sequelizeInstance) {
                if (sequelizeInstance && sequelizeInstance.get('__password') == self._encryptPassword(params.password, sequelizeInstance.get('__salt'))) {
                    resolve(self._object(sequelizeInstance, 'User'));
                } else {
                    resolve();
                }
            }, function(error) {
                reject(new errors.BackeryDatabaseError(error));
            });
        });
    }
    
    return self._Promise.reject(new errors.BackerInvalidParametersError(
        'Authentification method is not supported `' + method + '`', ['method']));
}

module.exports = SequelizeModel;
