var Sequelize = require('sequelize');
var _ = require('underscore');
var errors = require('../../utils/errors.js');

var AuthMethodDefinition = require('../definition/AuthMethodDefinition.js');
var TypeDefinition = require('../definition/TypeDefinition.js');

var BackerEntity = require('../BackerEntity.js');
var SequelizeEntityImpl = require('./SequelizeEntityImpl.js');

var SequelizeNameMapper = require('./SequelizeNameMapper.js');

var SequelizeModel = function() {
    
}

SequelizeModel.prototype.define = function(definition, Promise, databaseURI, databaseOptions) {
    var self = this;
    
    self._definition = definition;
    
    self._Promise = Promise;
    self._promiseWrap = function(sequelizePromise, transformResult) {
        return new Promise(function(resolve, reject) {
            sequelizePromise.then(function(res) {
                resolve(transformResult ? transformResult(res) : res);
            }).catch(function(error) {
                reject(new errors.BackerDatabaseError(error));
            });
        });
    }
    
    self._sequelize = new Sequelize(databaseURI, _.extend(databaseOptions, {
        logging: function(str) {
        }
    }));
    
    self._sequelizeModels = { };
    
    
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
    
    return self._sequelize.query('SET FOREIGN_KEY_CHECKS = 0').then(function(){
        return self._sequelize.sync(); //{ force: true });
    }).then(function(){
        return self._sequelize.query('SET FOREIGN_KEY_CHECKS = 1')
    });
}

SequelizeModel.prototype.getDefinition = function() {
    return this._definition;
}

SequelizeModel.prototype.entity = function(name) {
    return new BackerEntity(this._definition.entities[name],
        new SequelizeEntityImpl(this._definition.entities[name], this._sequelizeModels[name], {
            model: this,
            Promise: this._Promise,
            promiseWrap: this._promiseWrap
        }));
}

module.exports = SequelizeModel;
