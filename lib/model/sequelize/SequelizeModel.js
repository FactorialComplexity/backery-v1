var Sequelize = require('sequelize');
var _ = require('underscore');
var names = require('../utils/names.js');

var AuthMethodDefinition = require('../definition/AuthMethodDefinition.js');
var TypeDefinition = require('../definition/TypeDefinition.js');

var SequelizeModel = function() {
    
}

SequelizeModel.prototype.define = function(definition, databaseURI, databaseOptions) {
    var self = this;
    
    self.sequelize = new Sequelize(databaseURI, _.extend(databaseOptions, {
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
                dbFields[field.name] = { type: Sequelize.STRING };
                
                if (_.contains(loginFields, field)) {
                    dbFields[field.name].unique = true;
                }
            } else if (field.type.value == TypeDefinition.Integer) {
                dbFields[field.name] = { type: Sequelize.INTEGER };
            } else if (field.type.value == TypeDefinition.Number) {
                dbFields[field.name] = { type: Sequelize.DOUBLE };
            } else if (field.type.value == TypeDefinition.Boolean) {
                dbFields[field.name] = { type: Sequelize.BOOLEAN };
            } else if (field.type.value == TypeDefinition.Array) {
                dbFields[field.name] = { type: Sequelize.STRING };
            } else if (field.type.value == TypeDefinition.Object) {
                dbFields[field.name] = { type: Sequelize.STRING };
            } else if (field.type.value == TypeDefinition.File) {
                dbFields[field.name] = { type: Sequelize.STRING };
            } else if (!field.type.isRelation()) {
                throw new Error('Unknown type');
            }
        });
        
        self._sequelizeModels[entity.name] = self.sequelize.define(entity.name, dbFields);
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
                            as: names.toUpperCaseFirstLetter(field.name),
                            foreignKey: '_' + field.name + 'Id'
                        });
                        
                        if (field.type.reverse) {
                            if (field.type.reverse.type.value == TypeDefinition.Relation_Many) {
                                sequelizeAssociatedModel.hasMany(sequelizeModel, {
                                    as: names.toUpperCaseFirstLetter(field.type.reverse.name),
                                    foreignKey: '_' + field.name + 'Id'
                                });
                            } else {
                                throw new Error('Reverse is not supported for one-to-one relations (' +
                                    entity.name + '.' + field.name + ' -> ' + 
                                    field.type.relatedEntity.name + '.' + field.type.reverse.name + ')');
                            }
                        }
                    } else if (field.type.value == TypeDefinition.Relation_Many) {
                        // handle many-to-many
                        
                        if (!field.type.reverse || field.type.reverse.type.value == TypeDefinition.Relation_Many) {
                            
                            var matchTableName = '_' + entity.name + '_' + field.name + '_' +
                            field.type.relatedEntity.name + (field.type.reverse ? ('_' + field.type.reverse.name) : '');
                            
                            sequelizeModel.belongsToMany(sequelizeAssociatedModel, {
                                as: names.toUpperCaseFirstLetter(field.name),
                                through: matchTableName
                            });
                            
                            if (field.type.reverse) {
                                sequelizeAssociatedModel.belongsToMany(sequelizeModel, {
                                    as: names.toUpperCaseFirstLetter(field.type.reverse.name),
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
    
    return self.sequelize.query('SET FOREIGN_KEY_CHECKS = 0').then(function(){
        return self.sequelize.sync({ force: true });
    }).then(function(){
        return self.sequelize.query('SET FOREIGN_KEY_CHECKS = 1')
    });
}

module.exports = SequelizeModel;
