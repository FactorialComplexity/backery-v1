var _ = require('underscore');

var FieldReference = require('./FieldReference.js');
var EntityReference = require('./EntityReference.js');

var Methods = {
    Password: 1,
    Facebook: 2,
    Twitter: 3
};

var AuthMethodDefinition = function(data) {
    var methodName = data.method.substring(0, 1).toUpperCase() + data.method.substring(1);
    if (Methods[methodName]) {
        this.method = Methods[methodName];
    } else {
        throw new Error('Uknown authentication method: ' + data.method);
    }
    
    if (this.method == Methods.Password) {
        this.loginFields = _.map(data.loginFields, function(loginField) {
            return new FieldReference(new EntityReference('User'), loginField);
        });
    }
}

AuthMethodDefinition.prototype.isPassword = function() {
    return this.method == Methods.Password;
}

AuthMethodDefinition.prototype.isFacebook = function() {
    return this.method == Methods.Facebook;
}

AuthMethodDefinition.prototype.isTwitter = function() {
    return this.method == Methods.Twitter;
}

_.each(Methods, function(value, key) {
    AuthMethodDefinition[key] = value;
});

module.exports = AuthMethodDefinition;
