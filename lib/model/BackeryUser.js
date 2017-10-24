var util = require('util');
var _ = require('underscore');

var BackeryObject = require('./BackeryObject.js');

var errors = require('../utils/errors.js');

var BackeryUser = function(impl, Backery) {
    BackeryObject.apply(this, arguments);
    
    var self = this;
    var _super = {
        set: this.set,
        setValues: this.setValues,
        save: this.save,
        toStruct: this.toStruct
    };
    
    this.setValues = function(values) {
        var self = this;
        
        if (!Backery.Struct.isStruct(values)) {
            if (!_.isUndefined(values['password'])) {
                var value = values['password'];
                if (value && _.isString(value) && value.length) {
                    if (!self.isNew()) {
                      if (!values.oldPassword) {
                        throw new errors.BackeryInvalidParametersError('You must provide old password to change password');
                      }
                      if (!
                        (self.isPasswordRecoveryTokenValid(values.oldPassword.toString()) ||
                        impl.User_isPasswordCorrect(values.oldPassword.toString()))
                      ) {
                        throw new errors.BackeryUnauthorizedError('User credentials are invalid',
                          'InvalidCredentialsError');
                      }
                    } 
                    impl.User_setPassword(value);
                }
                else
                    throw new errors.BackeryInvalidParametersError('Password should be non-empty string', ['password']);
            
                delete values['password'];
            }
            
            // if (!_.isUndefined(values['blockedAt'])) {
            //     throw new errors.BackeryInvalidParametersError('Cannot set blockedAt value directly', ['blockedAt']);
            // }
        
            if (!_.isUndefined(values['blocked'])) {
                if (values['blocked']) {
                    values['blockedAt'] = new Date();
                } else {
                    values['blockedAt'] = null;
                }
            }
        } else {
            var roles = values.getValue('_roles');
            if (!_.isUndefined(roles)) {
                _.each(roles, function(roleName) {
                    self.addRole(roleName);
                });
                
                values.unset('_roles');
            }
        }
        
        return _super.setValues(values);
    }
    
    this.set = function(key, value) {
        var values = { };
        values[key] = value;
        return self.setValues(values);
    }
    
    this.toStruct = function(options) {
        var struct = _super.toStruct(options);
        
        if (options && options.serializeUserRoles) {
            struct.set('_roles', new Backery.Struct.Array(_.map(this.getRoles(), function(role) {
                return role.name;
            })));
        }
        
        return struct;
    }
    
    this.save = function() {
        impl.getEntityDefinition().validateBeforeSave(this);
        
        return _super.save();
    }
    
    this.isPasswordCorrect = function(password) {
        return impl.User_isPasswordCorrect(password);
    }
    
    this.isPasswordSet = function() {
        return impl.User_isPasswordSet();
    }
    
    this.resetPasswordRecoveryToken = function() {
        return impl.User_resetPasswordRecoveryToken();
    }
    
    this.isPasswordRecoveryTokenValid = function(token) {
        return impl.User_isPasswordRecoveryTokenValid(token);
    }
    
    this.setFacebookUserId = function(facebookUserId) {
        return impl.User_setFacebookUserId(facebookUserId);
    }
    
    this.getFacebookUserId = function() {
        return impl.User_getFacebookUserId();
    }
    
    this.setTwitterUserId = function(twitterUserId) {
        return impl.User_setTwitterUserId(twitterUserId);
    }
    
    this.getTwitterUserId = function() {
        return impl.User_getTwitterUserId();
    }
    
    this.setGoogleUserId = function(googleUserId) {
        return impl.User_setGoogleUserId(googleUserId);
    }
    
    this.getGoogleUserId = function() {
        return impl.User_getGoogleUserId();
    }
    
    this.validatePasswordAuthentication = function() {
        impl.getEntityDefinition().validatePasswordAuthentication(this);
    }
    
    this.hasRole = function(role) {
        if (_.isString(role)) {
            role = Backery.Model.Roles[role];
        }
        
        if (role.isVirtual())
            return undefined;

        var self = this;
        
        if (!impl.User_hasRole(role)){
            return !!_.find(role.include, function(role){
                return self.hasRole(role);
            });
        } else {
            return true;
        }
        
        return false;
    }

    this.getRoles = function() {
        return impl.User_getRoles();
    }

    this.addRole = function(role) {
        if (_.isString(role)) {
            role = Backery.Model.Roles[role];
        }
        
        impl.User_addRole(role);
    }

    this.removeRole = function(role) {
        if (_.isString(role)) {
            role = Backery.Model.Roles[role];
        }
        
        impl.User_removeRole(role);
    }
}


util.inherits(BackeryUser, BackeryObject);

module.exports = BackeryUser;
