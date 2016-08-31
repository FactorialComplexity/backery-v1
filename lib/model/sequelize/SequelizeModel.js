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
var SequelizeSQL = require('./SequelizeSQL.js');

var SequelizeModel = function() {
    
}

SequelizeModel.prototype.define = function(definition, databaseURI, databaseOptions, Backery) {
    var self = this;
    
    if (!databaseOptions.caseSensitiveCollation) {
        console.log('WARNING: caseSensitiveCollation is not set, all case sensitive queries will have the default case sensitivity');
    }
    
    if (!databaseOptions.caseInsensitiveCollation) {
        console.log('WARNING: caseSensitiveCollation is not set, all case insensitive queries will have the default case sensitivity');
    }
    
    self.Backery = Backery;
    
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
                    details = _.map(error.errors, function(subError) {
                        return subError.message + ": " + subError.value;
                    });
                    reject(new errors.BackeryConsistencyError(details.join()));
                }
                
                console.error('SEQUELIZE ERROR', error.stack);
                reject(new errors.BackeryDatabaseError(error, reason, details));
            });
        });
    }
    
    var backeryObjectFactory = new BackeryObjectFactory(undefined, Backery);
    self.setDatabaseHooksProvider = function(databaseHooksProvider) {
        backeryObjectFactory = new BackeryObjectFactory(databaseHooksProvider, Backery);
    }
    
    /**
     * Creates BackeryObject with identifier, not fetching any data, assuming the object exists in database (reference)
     * @return created BackeryObject instance
     */
    self.createBackeryObjectRef = function(objectId, entityDefinition) {
        var sequelizeInstance = self._sequelizeModels[entityDefinition.name].build({ id: parseInt(objectId) },
            { isNewRecord : false });
        return backeryObjectFactory.create(new SequelizeObjectImpl(sequelizeInstance, entityDefinition, self, undefined, true));
    };
    
    /**
     * Creates new empty BackeryObject (not saved)
     * @return created BackeryObject instance
     */
    self.createBackeryObject = function(entityDefinition) {
        var sequelizeInstance = self._sequelizeModels[entityDefinition.name].build();
        return backeryObjectFactory.create(new SequelizeObjectImpl(sequelizeInstance, entityDefinition, self,undefined, false));
    };
    
    /**
     * Creates BackeryObjects from array of Sequelize.Instances. Objects are fully fetched and afterFetch hooks are processed.
     * All Sequelize.Instances should have the model corresponding to entityDefinition.
     * @returns Backery.Promise, fullfillable by array of BackeryObjects
     */
    self.loadBackeryObjects = function(sequelizeInstances, entityDefinition, include) {
        if (!sequelizeInstances)
            return Backery.Promise.resolve();
        
        if (_.isString(entityDefinition)) {
            entityDefinition = this._definition.entities[entityDefinition];
        }
        
        var afterFetchCallbacks = [];
        function afterFetchCallbackInstaller(callback) {
            afterFetchCallbacks.push(callback);
        }
    
        var objectGroup0 = {
            entityDefinition: entityDefinition,
            objects: [],
            include: include // TODO
        };
        var objectGroups = [objectGroup0];
        
        _.each(sequelizeInstances, function(sequelizeInstance) {
            var impl = new SequelizeObjectImpl(sequelizeInstance, entityDefinition, self, include, false,
                afterFetchCallbackInstaller);
            var object = backeryObjectFactory.create(impl);
            
            objectGroup0.objects.push(object);
            objectGroups.push.apply(objectGroups, impl.getObjectGroupsForCascadeFetch());
        });
        
        // Run afterFetch for each objectGroup
        return Backery.Promise.all(_.map(objectGroups, function(objectGroup) {
            var afterFetch = backeryObjectFactory.databaseHooksProvider.getDatabaseHooks(objectGroup.entityDefinition).afterFetch;
            if (afterFetch) {
                return afterFetch(objectGroup.objects, objectGroup.include);
            } else {
                return Backery.Promise.resolve();
            }
        })).then(function() {
            _.each(afterFetchCallbacks, function(callback) {
                callback();
            });
            
            return Backery.Promise.resolve(objectGroup0.objects);
        });
    }
    
    self.fetchBackeryObject = function(object, impl, include) {
        var afterFetchCallbacks = [];
        function afterFetchCallbackInstaller(callback) {
            afterFetchCallbacks.push(callback);
        }
    
        var objectGroup0 = {
            entityDefinition: impl.getEntityDefinition,
            objects: [object],
            include: include // TODO
        };
        
        var objectGroups = [objectGroup0];
        
        impl.startAfterFetchCascade(include, afterFetchCallbackInstaller);
        objectGroups.push.apply(objectGroups, impl.getObjectGroupsForCascadeFetch());
        
        // Run afterFetch for each objectGroup
        return Backery.Promise.all(_.map(objectGroups, function(objectGroup) {
            var afterFetch = backeryObjectFactory.databaseHooksProvider.getDatabaseHooks(objectGroup.entityDefinition).afterFetch;
            if (afterFetch) {
                return afterFetch(objectGroup.objects, objectGroup.include);
            } else {
                return Backery.Promise.resolve();
            }
        })).then(function() {
            _.each(afterFetchCallbacks, function(callback) {
                callback();
            });
            
            return Backery.Promise.resolve(objectGroup0.objects);
        });
    }
    
    /**
     * Creates BackeryObject from Sequelize.Instance. Objects are fully fetched and afterFetch hooks are processed.
     * @returns Backery.Promise, fullfillable by array of BackeryObjects
     */
    self.loadBackeryObject = function(sequelizeInstance, entityDefinition, include) {
        if (!sequelizeInstance)
            return Backery.Promise.resolve(); 
        
        return self.loadBackeryObjects([sequelizeInstance], entityDefinition, include).spread(function(object) {
            return Backery.Promise.resolve(object);
        });
    }
    
    /**
     * Creates BackeryObject from Sequelize.Instance, but does not process afterFetch hook.
     * @return object with keys:
     *         object - created BackeryObject
     *         impl - created SequelizeObjectImpl
     */
    self.prepareBackeryObjectForFetching = function(sequelizeInstance, entityDefinition, include, afterFetchCallbackInstaller) {
        if (_.isString(entityDefinition)) {
            entityDefinition = this._definition.entities[entityDefinition];
        }
        
        var impl = new SequelizeObjectImpl(sequelizeInstance, entityDefinition, self, include, false, afterFetchCallbackInstaller);
        return {
            object: backeryObjectFactory.create(impl),
            impl: impl
        };
    }
    
    
    function compactUndefinedValues(object) {
        return _.pick(object, function(value, key, object) {
            return !_.isUndefined(value);
        });
    }
    
    self.transformInclude = function(entityDefinition, include) {
        return _.compact(_.map(include || [], function(inc) {
            var key = _.keys(inc)[0];
            var params = inc[key];
            
            var relatedEntityDefinition = entityDefinition.fields[key].type.relatedEntity;
            
            if (!entityDefinition.fields[key].virtual) {
                if (entityDefinition.fields[key].type.value == TypeDefinition.Relation_One) {
                    return compactUndefinedValues({
                        model: self._sequelizeModels[relatedEntityDefinition.name],
                        as: SequelizeNameMapper.sequelizeAssociationAs(entityDefinition.fields[key]),
                        include: params.$include ? self.transformInclude(relatedEntityDefinition, params.$include) : undefined
                    });
                } else if (entityDefinition.fields[key].type.value == TypeDefinition.Relation_Many) {
                    if ((!_.isUndefined(params.$offset) || !_.isUndefined(params.$limit)) &&
                        entityDefinition.fields[key].type.reverse.type.value == TypeDefinition.Relation_Many) {
                    
                        throw new errors.BackeryUnsupportedError('Limit and offset for included many-to-many relations is not currently supported');
                    }
                
                    
                    return compactUndefinedValues({
                        model: self._sequelizeModels[relatedEntityDefinition.name],
                        as: SequelizeNameMapper.sequelizeAssociationAs(entityDefinition.fields[key]),
                        offset: params.$offset,
                        limit: params.$limit,
                        order: params.$sort ? self.transformSort(relatedEntityDefinition, params.$sort) : undefined,
                        include: params.$include ? self.transformInclude(relatedEntityDefinition, params.$include) : undefined
                    });
                }
            }
        }));
    }
    
    self.transformWhere = function(entityDefinition, where) {
        function mapCondition(condition) {
            
            var op = _.keys(condition)[0];
            var param = condition[op];

            if (op == '$and' || op == '$or') {
                return _.object([[
                    op,
                    _.map(param, function(condition) {
                        return mapCondition(condition);
                    }).filter(function(x) {
                        return !_.isUndefined(x);
                    })
                ]]);
            } else if (op == '$eq' || op == '$ne' ||
                    op == '$gt' || op == '$gte' ||
                    op == '$lt' || op == '$lte') {
                
                var key = _.keys(param)[0];
                var field = entityDefinition.fields[key];
                var value = param[key];
                
                if (field && field.type.isRelationOne()) {
                    key = SequelizeNameMapper.sequelizeAssociationForeignKey(field);
                    value = value ? parseInt(value.objectId()) : null
                }
                
                if (key == 'id') {
                    value = parseInt(value);
                }
                
                if (op == '$eq') {
                    return _.object([key], [value]);
                } else if (op == '$ne') {
                    // special handling to process null values correctly
                    return Sequelize.literal('(NOT `' + entityDefinition.name + '`.`' + key +
                        '` <=> ' + self._sequelize.escape(param[key]) + ')');
                } else {
                    return _.object([key],
                        [_.object(
                            [op],
                            [value]
                        )]
                    );
                }
            // } else if (op == '$nearby') {
            //     return {};
            } else if (op == '$contains') {
                if (databaseOptions.caseSensitiveCollation) {
                    return Sequelize.literal('`' + entityDefinition.name + '`.`' + _.keys(param)[0] +
                        '` LIKE ' + self._sequelize.escape('%' + param[_.keys(param)[0]] + '%') + ' COLLATE \'' +
                        databaseOptions.caseSensitiveCollation + '\'');
                } else {
                    return _.object([[
                        _.keys(param)[0],
                        _.object([[
                            '$like',
                            '%' + param[_.keys(param)[0]] + '%'
                        ]])
                    ]]);
                }
            }  else if (op == '$containsCI') {
                if (databaseOptions.caseInsensitiveCollation) {
                    return Sequelize.literal('`' + entityDefinition.name + '`.`' + _.keys(param)[0] +
                        '` LIKE ' + self._sequelize.escape('%' + param[_.keys(param)[0]] + '%') + ' COLLATE \'' +
                        databaseOptions.caseInsensitiveCollation + '\'');
                } else {
                    return _.object([[
                        _.keys(param)[0],
                        _.object([[
                            '$like',
                            '%' + param[_.keys(param)[0]] + '%'
                        ]])
                    ]]);
                }
             } else if (op == '$in' || op == '$notIn') {
                 var key = _.keys(param)[0];
                 var field = entityDefinition.fields[key];
                 var value = param[key];
                 
                 if (key == 'id') {
                     value = _.map(value, function(v) { return parseInt(v); });
                 } else if (field && field.type.isRelationOne()) {
                     key = SequelizeNameMapper.sequelizeAssociationForeignKey(field);
                     value = _.map(value, function(v) { return v ? parseInt(v.objectId()) : null; });
                 }
                 
                 return _.object([key],
                     [_.object(
                         [op],
                         [value]
                     )]
                 );
             }
        }
        
        if (where) {
            return mapCondition(where);
        }
    }
    
    self.transformSort = function(entityDefinition, sort) {
        return _.map(sort, function(pair) {
            var key = _.keys(pair)[0];
            var dir = pair[key];
            
            return [key, dir];
        });
    }
    
    self.transformAttributes = function(entityDefinition, params) {
        var op = _.keys(params)[0];
        
        if (op == '$and' || op == '$or') {
            return mapAttributes(params[op]);
        } else {
            return mapAttributes([params]);
        }
        
        function mapAttributes(params) {
            return _.object([[
                'include',
                _.map(params, function(pair) {
                    var key = _.keys(pair)[0];
                    if (key == '$nearby') {
                        return [Sequelize.literal('( 6371 * acos( cos( radians(' +
                            pair[key].lat + ') ) * cos( radians(  X(  `location` ) ) ) * cos( radians( Y(  `location` ) ) - radians(' +
                            pair[key].lon + ') ) + sin( radians('+pair[key].lat+') ) * sin( radians( X(  `location` ) ) ) ) )'), 'distance']
                    }
                }).filter(function(x) {
                    return !_.isUndefined(x);
                })
            ]]);
        }
    }
    
    self.transformHaving = function(entityDefinition, where) {
        
        var op = _.keys(where)[0];
        
        if (op == '$and' || op == '$or') {
            return mapAttributes(where[op]);
        } else {
            return mapAttributes([where]);
        }
        
        function mapAttributes(where) {
            return _.map(where, function(pair) {
                var key = _.keys(pair)[0];
                if (key == '$nearby') {
                    return _.object([['distance', _.object([['$lte', pair[key].distance]])]])
                }
            }).filter(function(x) {
                return !_.isUndefined(x);
            })
        }
    }
    
    var loggingFunction = databaseOptions.shouldLogQueries ? function(str) {
        console.log(str);
    } : undefined;
    delete databaseOptions.shouldLogQueries;
    
    self._sequelize = new Sequelize(databaseURI, _.extend(databaseOptions, {
        logging: loggingFunction
    }));
    
    self._sequelizeModels = { };
    self.entities = { };
    self.fileManagers = { };
    
    // Simple fields
    _.each(definition.entities, function(entity, name) {
        var dbFields = { };
        var loginFields = [];
        
        if (entity.isUserEntity()) {
            _.each(definition.authMethods, function(authMethod) {
                if (authMethod.method == AuthMethodDefinition.Password) {
                    dbFields['__password'] = Sequelize.STRING(32);
                    dbFields['__salt'] = Sequelize.STRING(40);
                    
                    if (authMethod.passwordRecoveryEmailField) {
                        dbFields['__passwordRecoveryToken'] = Sequelize.STRING(40);
                        dbFields['__passwordRecoveryTokenExpiresAt'] = Sequelize.DATE;
                    }
                    
                    loginFields = authMethod.loginFields;
                } else if (authMethod.method == AuthMethodDefinition.Facebook) {
                    dbFields['__facebookUserId'] = { type: Sequelize.STRING(32), unique: true };
                } else if (authMethod.method == AuthMethodDefinition.Twitter) {
                    dbFields['__twitterUserId'] = { type: Sequelize.STRING(32), unique: true };
                } else if (authMethod.method == AuthMethodDefinition.Google) {
                    dbFields['__googleUserId'] = { type: Sequelize.STRING(32), unique: true };
                }
            });
        } else if (entity.isFileEntity()) {
            dbFields['__size'] = Sequelize.STRING;
            dbFields['__contentType'] = Sequelize.STRING;
            dbFields['__storageType'] = Sequelize.STRING(2);
            dbFields['__storage'] = Sequelize.STRING;
        }
        
        _.each(entity.fields, function(field) {
            // Virtual fields do not have any representaion in database
            if (field.virtual) {
                return;
            }
            
            var dbType;
            var key = SequelizeNameMapper.sequelizeFieldName(field);
            var value;
            
            if (field.type.value == TypeDefinition.String) {
                if (field.type.limit) {
                    value = {
                        type: Sequelize.STRING(field.type.limit),
                        unique: _.contains(loginFields, field),
                        defaultValue: null
                    };
                } else {
                    value = { type: Sequelize.TEXT, defaultValue: null };
                }
            } else if (field.type.value == TypeDefinition.Integer) {
                value = { type: Sequelize.INTEGER, defaultValue: null };
            } else if (field.type.value == TypeDefinition.Number) {
                value = { type: Sequelize.DOUBLE, defaultValue: null };
            } else if (field.type.value == TypeDefinition.Boolean) {
                value = { type: Sequelize.BOOLEAN, defaultValue: null };
            } else if (field.type.value == TypeDefinition.Date) {
                value = { type: Sequelize.DATE, defaultValue: null };
            } else if (field.type.value == TypeDefinition.Array) {
                value = { type: Sequelize.TEXT, defaultValue: null };
            } else if (field.type.value == TypeDefinition.Dictionary) {
                value = { type: Sequelize.TEXT, defaultValue: null };
            } else if (field.type.value == TypeDefinition.Location) {
                value = { type: Sequelize.GEOMETRY('POINT')};
            } else if (field.type.value == TypeDefinition.Object) {
                value = { type: Sequelize.TEXT, defaultValue: null };
            } else if (field.type.value == TypeDefinition.File) {
                value = { type: Sequelize.TEXT, defaultValue: null };
            } else if (field.type.value == TypeDefinition.Relation_One) {
                key = SequelizeNameMapper.sequelizeAssociationForeignKey(field);
                value = {
                    type: Sequelize.INTEGER,
                    references: {
                        model: SequelizeNameMapper.sequelizeTableName(field.type.relatedEntity),
                        key: 'id',
                        //constraints: false
                    }
                };
            } else if (!field.type.isRelation()) {
                throw new errors.BackeryError('Unsupported type (' + field.type.value + ')');
            }
            
            if (field.unique) {
                value.unique = field.unique;
            }
            
            if (value) {
                dbFields[key] = value;
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
            // Virtual fields do not have any representaion in database
            if (field.virtual) {
                return;
            }
            
            if (field.type.isRelation()) {
                if (!field.type.reverse || !_.contains(createdRelations, field.type.reverse)) {
                    // Create relation, unless it was already created
                    var sequelizeAssociatedModel = self._sequelizeModels[field.type.relatedEntity.name];
                    
                    if (field.type.value == TypeDefinition.Relation_One) {
                        // handle one-to-one and many-to-one
                        
                        sequelizeModel.belongsTo(sequelizeAssociatedModel, {
                            as: SequelizeNameMapper.sequelizeAssociationAs(field),
                            foreignKey: SequelizeNameMapper.sequelizeAssociationForeignKey(field),
                            onDelete: 'SET NULL',
                            onUpdate: 'CASCADE' 
                            //constraints: false
                        });
                        
                        if (field.type.reverse) {
                            if (field.type.reverse.type.value == TypeDefinition.Relation_Many) {
                                sequelizeAssociatedModel.hasMany(sequelizeModel, {
                                    as: SequelizeNameMapper.sequelizeAssociationAs(field.type.reverse),
                                    foreignKey: SequelizeNameMapper.sequelizeAssociationForeignKey(field),
                                    //constraints: false
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
                                through: matchTableName,
                                //constraints: false
                            });
                            
                            if (field.type.reverse) {
                                sequelizeAssociatedModel.belongsToMany(sequelizeModel, {
                                    as: SequelizeNameMapper.sequelizeAssociationAs(field.type.reverse),
                                    through: matchTableName,
                                    //constraints: false
                                });
                            }
                        }
                    }
                    
                    createdRelations.push(field);
                }
            }
        });
    });
    
    
    // SQL
    self.SQL = new SequelizeSQL(self);
    
    
    // Auth models
    self.__OAuth_AccessToken = self._sequelize.define('__OAuth_AccessToken', {
        token: { type: Sequelize.STRING(50), primaryKey: true },
        clientId: Sequelize.STRING,
        expires: Sequelize.DATE
    });
    self.__OAuth_AccessToken.belongsTo(self._sequelizeModels.User);
    
    self.__OAuth_RefreshToken = self._sequelize.define('__OAuth_RefreshToken', {
        token: { type: Sequelize.STRING(50), primaryKey: true },
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

//
// Public interface
//

SequelizeModel.prototype.registerFileManager = function(fileManager, isDefault) {
    if (isDefault) {
        this.defaultFileManager = fileManager;
        this.fileManagers[fileManager.getName()] = this.defaultFileManager;
    } else {
        this.fileManagers[fileManager.getName()] = fileManager;
    }
}

SequelizeModel.prototype.getFileManager = function(name) {
    return this.fileManagers[name];
}

SequelizeModel.prototype.getDefaultFileManager = function(name) {
    return this.defaultFileManager;
}

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
            resolve(accessToken);
        }, function(error) {
            reject(new errors.BackeryDatabaseError(error));
        });
    }).then(function(accessToken) {
        if (accessToken) {
            return self.loadBackeryObject(accessToken.User, 'User').then(function(user) {
                if (user) {
                    return self.Backery.Promise.resolve({
                        expires: accessToken.get('expires'),
                        user: {
                            id: user.objectId(),
                            object: user
                        }
                    });
                } else {
                    self.Backery.Promise.resolve();
                }
            });
        } else {
            return self.Backery.Promise.resolve();
        }
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
        self.__OAuth_RefreshToken.findById(refreshToken, {
            include: [self._sequelizeModels.User]
        }).then(function(refreshToken) {
            resolve(refreshToken);
        }, function(error) {
            reject(new errors.BackeryDatabaseError(error));
        });
    }).then(function(refreshToken) {
        if (refreshToken) {
            return self.loadBackeryObject(refreshToken.User, 'User').then(function(user) {
                if (user) {
                    return self.Backery.Promise.resolve({
                        expires: refreshToken.get('expires'),
                        clientId: refreshToken.get('clientId'),
                        user: {
                            id: user.objectId(),
                            object: user
                        }
                    });
                } else {
                    self.Backery.Promise.resolve();
                }
            });
        } else {
            return self.Backery.Promise.resolve();
        }
    });
}

SequelizeModel.prototype.updateRefreshToken = function(refreshToken, refreshTokenLifetime) {
    var self = this;
    return new self.Backery.Promise(function(resolve, reject) {
        self.__OAuth_RefreshToken.findById(refreshToken).then(function(refreshToken) {
            if (refreshToken) {
                expires = new Date(new Date());
                expires.setSeconds(expires.getSeconds() + refreshTokenLifetime);
                refreshToken.set('expires', expires);
                refreshToken.save();
                resolve();
            } else {
                reject(new errors.BackeryConsistencyError('Invalid refresh token: ' + refreshToken));
            }
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

SequelizeModel.prototype.updateRefreshToken = function(refreshToken, refreshTokenLifetime) {
    var self = this;
    return new self.Backery.Promise(function(resolve, reject) {
        self.__OAuth_RefreshToken.findById(refreshToken).then(function(refreshToken) {
            if (refreshToken) {
                expires = new Date(new Date());
                expires.setSeconds(expires.getSeconds() + refreshTokenLifetime);
                refreshToken.set('expires', expires);
                refreshToken.save();
                resolve();
            } else {
                reject(new errors.BackeryConsistencyError('Invalid refresh token: ' + refreshToken));
            }
        }, function(error) {
            reject(new errors.BackeryDatabaseError(error));
        });
    });
}

SequelizeModel.prototype.findUserWithPasswordRecoveryToken = function(token) {
    var self = this;
    return new self.Backery.Promise(function(resolve, reject) {
        self._sequelizeModels.User.findOne({ where: { __passwordRecoveryToken: token } }).then(function(user) {
            resolve(user);
        }, function(error) {
            reject(new errors.BackeryDatabaseError(error));
        });
    }).then(function(user) {
        if (user) {
            return self.loadBackeryObject(user, 'User');
        } else {
            return self.Backery.Promise.resolve();
        }
    });
}

SequelizeModel.prototype.authUser = function(method, params) {
    var self = this;
    var methodDefinition = _.find(self._definition.authMethods, function(authMethod) {
        if (method == 'password' && authMethod.method == AuthMethodDefinition.Password) {
            return authMethod;
        } else if (method == 'facebook' && authMethod.method == AuthMethodDefinition.Facebook) {
            return authMethod;
        } else if (method == 'twitter' && authMethod.method == AuthMethodDefinition.Twitter) {
            return authMethod;
        } else if (method == 'google' && authMethod.method == AuthMethodDefinition.Google) {
            return authMethod;
        }
    });
    
    if (!methodDefinition) {
        return self.Backery.Promise.reject(new errors.BackeryConsistencyError('Authentication method \"' + method +
            '\" is not supported by the model'));
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
                resolve(sequelizeInstance);
            }, function(error) {
                reject(new errors.BackeryDatabaseError(error));
            });
        }).then(function(sequelizeInstance) {
            return self.loadBackeryObject(sequelizeInstance, 'User');
        }).then(function(user) {
            if (user && user.isPasswordCorrect(params.password)) {
                return self.Backery.Promise.resolve(user);
            } else {
                return self.Backery.Promise.resolve();
            }
        });
    } else {
        console.log(method, params);
        return new self.Backery.Promise(function(resolve, reject) {
            var userIdKey = '__' + method + 'UserId';
            query = {};
            query[userIdKey] = params[method + 'UserId'];
            self._sequelizeModels.User.findOne({ where: query }).then(function(sequelizeInstance) {
                resolve(sequelizeInstance);
            }, function(error) {
                reject(new errors.BackeryDatabaseError(error));
            });
        }).then(function(sequelizeInstance) {
            return self.loadBackeryObject(sequelizeInstance, 'User');
        });
    }
    
    return self.Backery.Promise.reject(new errors.BackeryInvalidParametersError(
        'Authentification method is not supported `' + method + '`', ['method']));
}

module.exports = SequelizeModel;
