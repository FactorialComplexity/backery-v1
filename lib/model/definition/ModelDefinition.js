var _ = require('underscore');

var EntityDefinition = require('./EntityDefinition.js');
var RoleDefinition = require('./RoleDefinition.js');
var TypeDefinition = require('./TypeDefinition.js');
var AuthMethodDefinition = require('./AuthMethodDefinition.js');
var EntityAccessDefinition = require('./EntityAccessDefinition.js');
var FieldAccessDefinition = require('./FieldAccessDefinition.js');

var ModelDefinition = function(data) {
    var self = this;
    
    self._data = data;
    
    
    self.getName = function() {
        return data.name;
    }
    
    self.getDisplayName = function() {
        return data.displayName;
    }
    
    
    // Load roles
    self.roles = _.object(_.map(data.roles, function(roleData) {
        return [roleData.name, new RoleDefinition(roleData)];
    }));
    
    var notAllowedRoles = _.intersection(_.keys(self.roles), _.keys(RoleDefinition.reservedRoles));
    if (notAllowedRoles.length) {
        throw new Error('There role names are reserved: ' + notAllowedRoles.concat(', '));
    }
    
    self.roles = _.extend(RoleDefinition.reservedRoles, self.roles);
    
    // Load entities
    self.entities = _.object(_.map(data.entities, function(entityData) {
        return [entityData.name, new EntityDefinition(entityData, self, false)];
    }));
    
    _.each(EntityDefinition.Predefined, function(data, entityName) {
        if (!self.entities[entityName]) {
            self.entities[entityName] = new EntityDefinition(data, self, true);
        }
    });

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
    
    function resolveRoleReference(ref, entity) {
        if (ref && ref.name) {
            return ref; // already resolved
        }
        
        if (ref) {
            if (_.isString(ref)) {
                ref = { roleName: ref };
            }
            
            if (/^\./.test(ref.roleName)) {
                // contextual
                
                var nextEntity = entity;
                var pathElements = ref.roleName.substring(1).split('.');
                if (pathElements.length === 1 && pathElements[0] === '') {
                    pathElements = [];
                }
                
                var relationPath = _.map(pathElements, function(fieldName) {
                    var field = nextEntity.fields[fieldName];
                    
                    if (!field) {
                        throw new Error('Invalid contextual role "' + ref.roleName + '" for entity ' + entity.name +
                            ': field "' + fieldName + '" is not found in entity "' + nextEntity.name + '"');
                    }
                    
                    if (!field.type.isRelation()) {
                        throw new Error('Invalid contextual role "' + ref.roleName + '" for entity ' + entity.name +
                            ': field "' + fieldName + '" in entity "' + nextEntity.name + '" is not a relation');
                    }
                    
                    if (field.virtual) {
                        throw new Error('Invalid contextual role "' + ref.roleName + '" for entity ' + entity.name +
                            ': field "' + fieldName + '" in entity "' + nextEntity.name +
                            '" is virtual (which is not currently supported)');
                    }
                    
                    nextEntity = field.type.relatedEntity;
                    return field;
                });
                
                if (!nextEntity.isUserEntity()) {
                    throw new Error('Invalid contextual role "' + ref.roleName + '" for entity ' + entity.name +
                        ': final entity in path is not User ("' + nextEntity.name + '")');
                }
                
                return new RoleDefinition(ref.roleName, {
                    contextual: true,
                    relationPath: relationPath
                });
            } else {
                var role = self.roles[ref.roleName];
                if (!role)
                    throw new Error('Undefined role ' + ref.roleName);
                return role;
            }
        }
    }
    
    function hasContextualRoles(allow) {
        return _.find(allow, function(role) {
            return role.isContextual()
        });
    }
    
    function resolveAccess(access, entity) {
        if (access === undefined) {
            return undefined;
        }
        
        access.allow = _.object(_.map(access.allow, function(roles, operation) {
            return [operation, _.map(roles, function(roleRef) {
                return resolveRoleReference(roleRef, entity);
            })];
        }));
        
        if (hasContextualRoles(access.allow.query)) {
            throw new Error('Contextual roles are not allowed for operation \"query\" (entity: ' +
                entity.name + ')');
        }
        
        if (hasContextualRoles(access.allow.create)) {
            throw new Error('Contextual roles are not allowed for operation \"create\" (entity: ' +
                entity.name + ')');
        }
        
        if (!entity && (hasContextualRoles(access.allow.read || hasContextualRoles(access.allow.write)))) {
            throw new Error('Contextual roles for field access specifiers are not currently supported');
        }
    }
    
    _.each(self.entities, function(entity) {
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
            
            resolveAccess(field.explicitAccess);
        });
    });
    
    _.each(self.entities, function(entity) {
        resolveAccess(entity.explicitAccess, entity);
        
        _.each(entity.fields, function(field) {
            resolveAccess(field.explicitAccess);
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
        
        if (authMethod.passwordRecoveryEmailField) {
            authMethod.passwordRecoveryEmailField = resolveFieldReference(authMethod.passwordRecoveryEmailField);
        }
    });
    
    // Resolve access rights
    function defaultEntityAccess(entity) {
        if (entity.isInstallationEntity()) {
            return new EntityAccessDefinition({
                read: [ resolveRoleReference('.user', entity) ],
                create: [ self.roles.User ],
                update: [ resolveRoleReference('.user', entity) ],
                delete: [ resolveRoleReference('.user', entity) ],
                query: [ ]
            });
        } else if (entity.isUserEntity()) {
            return new EntityAccessDefinition({
                read: [ resolveRoleReference('.', entity) ],
                create: [ ],
                update: [ resolveRoleReference('.', entity) ],
                delete: [ ],
                query: [ ]
            });
        } else {
            return new EntityAccessDefinition({
                read: [ self.roles.User ],
                create: [ self.roles.User ],
                update: [ self.roles.User ],
                delete: [ self.roles.User ],
                query: [ self.roles.User ]
            });
        }
    }
    
    _.each(self.entities, function(entity) {
        entity.access = defaultEntityAccess(entity).merged(entity.explicitAccess);
        
        _.each(entity.fields, function(field) {
            if (entity.isInstallationEntity() && field.name === 'user') {
                field.access = new FieldAccessDefinition({
                    read: [ self.roles.Public ],
                    write: [ ]
                });
            } else {
                field.access = (new FieldAccessDefinition({
                    read: [self.roles.Public],
                    write: [self.roles.User]
                })).merged(field.explicitAccess);
            }
        });
    });
    
    
    this.getAsJSONObject = function() {
        return self._data;
    }
}

module.exports = ModelDefinition;
