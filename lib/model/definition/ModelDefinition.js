var _ = require('underscore');

var EntityDefinition = require('./EntityDefinition.js');
var RoleDefinition = require('./RoleDefinition.js');
var TypeDefinition = require('./TypeDefinition.js');
var AuthMethodDefinition = require('./AuthMethodDefinition.js');

var ModelDefinition = function(data) {
    var self = this;
    
    self._data = data;
    
    // Load roles
    self.roles = _.object(_.map(data.roles, function(roleData) {
        return [roleData.name, new RoleDefinition(roleData)];
    }));
    
    var notAllowedRoles = _.intersection(_.keys(self.roles), _.keys(RoleDefinition.reservedRoles));
    if (notAllowedRoles.length) {
        throw new Error('There role names are reserved: ' + notAllowedRoles.concat(', '));
    }
    
    self.roles = _.extend(self.roles, RoleDefinition.reservedRoles);
    
    // Load entities
    self.entities = _.object(_.map(data.entities, function(entityData) {
        return [entityData.name, new EntityDefinition(entityData)];
    }));
    
    if (!self.entities[EntityDefinition.userEntityName]) {
        self.entities[EntityDefinition.userEntityName] = EntityDefinition.User();
    }
    
    // Load auth methods
    self.authMethods = _.map(data.authMethods, function(authMethodData) {
        return new AuthMethodDefinition(authMethodData);
    });
    
    // Resolve references
    function resolveEntityReference(ref) {
        if (ref) {
            var entity = self.entities[ref.entityName];
            if (!entity)
                throw new Error('Undefined entity ' + ref.entityName);
            return entity;
        }
    }
    
    function resolveFieldReference(ref) {
        if (ref) {
            var entity = resolveEntityReference(ref.entityReference);
            
            var field = entity.fields[ref.fieldName];
            if (!field)
                throw new Error('Undefined field ' + ref.fieldName + ' in entity ' + entity.name);
            
            return field;
        }
    }
    
    function resolveRoleReference(ref) {
        if (ref) {
            var role = self.roles[ref.roleName];
            if (!role)
                throw new Error('Undefined role ' + ref.roleName);
            return role;
        }
    }
    
    function resolveAccess(access) {
        access.allow = _.object(_.map(access.allow, function(roles, operation) {
            return [operation, _.map(roles, function(roleRef) {
                return resolveRoleReference(roleRef);
            })];
        }));
    }
    
    _.each(self.entities, function(entity) {
        resolveAccess(entity.access);
        
        _.each(entity.fields, function(field) {
            if (field.type.relatedEntity) {
                field.type.relatedEntity = resolveEntityReference(field.type.relatedEntity);
                field.type.reverse = resolveFieldReference(field.type.reverse);
            
                if (field.type.reverse) {
                    
                    if (!field.type.reverse.type.relatedEntity.isReference) {
                        // check that reverse relation has a correct type
                        if (entity != field.type.reverse.type.relatedEntity) {
                            throw new Error('Invalid reverse relation entity (' +
                                entity.name + '.' + field.name + ' -> ' + 
                                field.type.relatedEntity.name + '.' + field.type.reverse.name + ')');
                        }
                        
                        // one-to-one reverse relations are not supported
                        if (field.type.reverse.type.value == TypeDefinition.Relation_One &&
                            field.type.value == TypeDefinition.Relation_One) {
                            
                            throw new Error('Reverse is not supported for one-to-one relations (' +
                                entity.name + '.' + field.name + ' -> ' + 
                                field.type.relatedEntity.name + '.' + field.type.reverse.name + ')');
                        }
                    }
                }
            }
            
            resolveAccess(field.access);
        });
    });
    
    _.each(self.roles, function(role) {
        role.include = _.map(role.include, function(roleRef) {
            return resolveRoleReference(roleRef);
        });
    });
    
    _.each(self.authMethods, function(authMethod) {
        authMethod.loginFields = _.map(authMethod.loginFields, function(fieldRef) {
            var loginField = resolveFieldReference(fieldRef);
            if (loginField.type.value != TypeDefinition.String)
                throw new Error('Unsupported login field ' + loginField.name + ' (incorrect type, only String is supported)');
            
            return loginField;
        });
    });
}

module.exports = ModelDefinition;
