var Sequelize = require('sequelize');
var _ = require('underscore');

var AuthMethodDefinition = require('../definition/AuthMethodDefinition.js');
var TypeDefinition = require('../definition/TypeDefinition.js');

var SequelizeModel = function(definition, databaseURI, databaseOptions) {
    var self = this;
    
    self.sequelize = new Sequelize(databaseURI, _.extend(databaseOptions, {
        logging: function(str) {
        }
    }));
    
    
    // Basic fields
    _.each(definition.entities, function(entity, name) {
        var dbFields = { };
        var loginFields = [];
        
        if (entity.isUserEntity()) {
            _.each(definition.authMethods, function(authMethod) {
                if (authMethod.method == AuthMethodDefinition.Password) {
                    dbFields['_password'] = Sequelize.STRING(32);
                    dbFields['_salt'] = Sequelize.STRING;
                    
                    loginFields = authMethod.loginFields;
                } else if (authMethod.method == AuthMethodDefinition.Facebook) {
                    dbFields['_facebookUserId'] = { type: Sequelize.STRING, unique: true };
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
                dbFields['_fileName_' + field.name] = { type: Sequelize.STRING };
                dbFields['_fileStorageInfo_' + field.name] = { type: Sequelize.STRING };
            } else if (!field.type.isAssociation()) {
                throw new Error('Unknown type');
            }
        });
        
        self.sequelize.define(entity.name, dbFields);
    });
    
    self.sequelize.sync({ force: true });
}

module.exports = SequelizeModel;
