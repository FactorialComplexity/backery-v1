var Sequelize = require('sequelize');
var crypto = require('crypto');
var _ = require('underscore');
var errors = require('../../utils/errors.js');

var AuthMethodDefinition = require('../definition/AuthMethodDefinition.js');
var TypeDefinition = require('../definition/TypeDefinition.js');

var BackeryEntity = require('../BackeryEntity.js');
var BackeryObjectFactory = require('../BackeryObjectFactory.js');
var SequelizeEntityImpl = require('./SequelizeEntityImpl.js');
var SequelizeObjectImpl = require('./SequelizeObjectImpl.js');

var SequelizeNameMapper = require('./SequelizeNameMapper.js');

var SequelizeModel = function() {
    
}

SequelizeModel.prototype.define = function(definition, databaseURI, databaseOptions, Backery) {
    var self = this;
    
    self.Backery = Backery;
    self.SequelizeObjectImpl = SequelizeObjectImpl;
    
    self._definition = definition;
    
    self.promiseWrap = function(sequelizePromise, transformResult) {
        return new self.Backery.Promise(function(resolve, reject) {
            sequelizePromise.then(function(res) {
                resolve(transformResult ? transformResult(res) : res);
            }).catch(function(error) {
                var reason = undefined, details = undefined;
                if (error.name == 'SequelizeForeignKeyConstraintError') {
                    reason = 'BackeryObjectsNotFound';
                } else if (error.name == 'SequelizeUniqueConstraintError') {
                    reason = 'BackeryFieldValueIsNotUnique';
                    details = _.map(error.errors, function(subError) {
                        return {
                            field: subError.path,
                            value: subError.value
                        };
                    });
                }
                
                reject(new errors.BackeryDatabaseError(error, reason, details));
            });
        });
    }
    
    var backeryObjectFactory = new BackeryObjectFactory(Backery);
    self.createBackeryObject = function(impl) {
        return backeryObjectFactory.create(impl);
    }
    
    self.transformInclude = function(entityDefinition, include) {
        return _.map(include || [], function(include) {
            if (entityDefinition.fields[include.field].type.value == TypeDefinition.Relation_One) {
                return {
                    model: self._sequelizeModels[entityDefinition.fields[include.field].type.relatedEntity.name],
                    as: SequelizeNameMapper.sequelizeAssociationAs(entityDefinition.fields[include.field])
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
    
    self.transformWhere = function(entityDefinition, where) {
        function mapCondition(condition) {
            
            var key = _.keys(condition)[0];
            var value = condition[key];
            
            if (key == '$and' || key == '$or') {
                return _.object([[
                    key,
                    _.map(value, function(value) {
                        return mapCondition(value);
                    })
                ]]);
            } else if (key == '$eq') {
                return value;
            } else if (key == '$ne' ||
                    key == '$gt' || key == '$gte' ||
                    key == '$lt' || key == '$lte') {
                
                return _.object([[
                    _.keys(value)[0],
                    _.object([[
                        key,
                        value[_.keys(value)[0]]
                    ]])
                ]]);
            } else if (key == '$contains') {
                return _.object([[
                    _.keys(value)[0],
                    _.object([[
                        '$like',
                        '%' + value[_.keys(value)[0]] + '%'
                    ]])
                ]]);
            }
        }
        
        if (where) {
            return mapCondition(where);
        }
    }
    
    self.transformSort = function(entityDefinition, sort) {
        
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
                throw new errors.BackeryError('Unknown type');
            }
        });
        
        self._sequelizeModels[entity.name] = self._sequelize.define(SequelizeNameMapper.sequelizeModelName(entity), dbFields);
        
        self.entities[entity.name] = new BackeryEntity(self._definition.entities[entity.name],
            new SequelizeEntityImpl(self._definition.entities[entity.name], self._sequelizeModels[entity.name], self), self.Backery);
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
                                throw new errors.BackeryError('Reverse is not supported for one-to-one relations (' +
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
    if (!sequelizeInstance)
        return;
    
    if (_.isString(entityDefinition)) {
        entityDefinition = this._definition.entities[entityDefinition];
    }
    
    return this.createBackeryObject(new SequelizeObjectImpl(sequelizeInstance, entityDefinition, this));
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
    return new self.Backery.Promise(function(resolve, reject) {
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
        expires: expires
    });
    instance.setUser(parseInt(user.id), { save: false });
    
    return new self.Backery.Promise(function(resolve, reject) {
        instance.save().then(function() {
            resolve();
        }, function(error) {
            reject(new errors.BackeryDatabaseError(error));
        });
    });
}

SequelizeModel.prototype.getRefreshToken = function(refreshToken) {
    var self = this;
    return new self.Backery.Promise(function(resolve, reject) {
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
    
    return new self.Backery.Promise(function(resolve, reject) {
        instance.save().then(function() {
            resolve();
        }, function(error) {
            reject(new errors.BackeryDatabaseError(error));
        });
    });
}

SequelizeModel.prototype.authUser = function(method, params) {
    var self = this;
    var methodDefinition = _.find(self._definition.authMethods, function(authMethod) {
        if (method == 'password' && authMethod.method == AuthMethodDefinition.Password) {
            return authMethod;
        }
    });
    
    if (!methodDefinition) {
        return self.Backery.Promise.reject(new errors.BackeryConsistencyError('Login/password based authentication method is not supported by the model'));
    }
    
    if (method == 'password') {
        var usernameString = params.username;
        var loginField = methodDefinition.loginFields[0];
        var login = usernameString;
        
        if (usernameString.indexOf(':') != -1) {
            var fieldName = usernameString.substring(0, usernameString.indexOf(':'));
            
            loginField = _.find(methodDefinition.loginFields, function(field) {
                return field.name == fieldName;
            });
            
            if (!loginField) {
                return self.Backery.Promise.reject(new errors.BackeryConsistencyError('Invalid login field: `' + fieldName + '`'));
            }
            
            login = usernameString.substring(usernameString.indexOf(':')+1);
        }
        
        var where = {};
        where[loginField.name] = login;
        
        return new self.Backery.Promise(function(resolve, reject) {
            self._sequelizeModels.User.findOne({ where: where }).then(function(sequelizeInstance) {
                var user = self._object(sequelizeInstance, 'User');

                if (user && user.isPasswordCorrect(params.password)) {
                    resolve(user);
                } else {
                    resolve();
                }
            }, function(error) {
                reject(new errors.BackeryDatabaseError(error));
            });
        });
    }
    
    return self.Backery.Promise.reject(new errors.BackeryInvalidParametersError(
        'Authentification method is not supported `' + method + '`', ['method']));
}

module.exports = SequelizeModel;
