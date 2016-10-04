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
        save: this.save
    };
    
    this.setValues = function(values) {
        if (values) {
            if (!_.isUndefined(values['password'])) {
                var value = values['password'];
                if (value && _.isString(value) && value.length)
                    impl.User_setPassword(value);
                else
                    throw new errors.BackeryInvalidParametersError('Password should be non-empty string', ['password']);
            
                delete values['password'];
            }
        
            if (!_.isUndefined(values['blockedAt'])) {
                throw new errors.BackeryInvalidParametersError('Cannot set blockedAt value directly', ['blockedAt']);
            }
        
            if (!_.isUndefined(values['blocked'])) {
                if (values['blocked']) {
                    values['blockedAt'] = new Date();
                } else {
                    values['blockedAt'] = null;
                }
            }
        }
        
        return _super.setValues(values);
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
}


util.inherits(BackeryUser, BackeryObject);

module.exports = BackeryUser;
