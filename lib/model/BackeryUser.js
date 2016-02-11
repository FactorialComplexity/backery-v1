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
    
    this.set = function(key, value) {
        if (key == 'password') { // special field name
            if (value && _.isString(value) && value.length)
                impl.User_setPassword(value);
            else
                throw new errors.BackeryInvalidParametersError('Password should be non-empty string', ['password']);
        } else {
            return _super.set(key, value);
        }
    }
    
    this.setValues = function(values) {
        if (!_.isUndefined(values['password'])) {
            this.set('password', values['password']);
            delete values['password'];
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
    
    this.validatePasswordAuthentication = function() {
        impl.getEntityDefinition().validatePasswordAuthentication(this);
    }
}


util.inherits(BackeryUser, BackeryObject);

module.exports = BackeryUser;
