var _ = require('underscore');

var BackeryRole = function(definition) {

    Object.defineProperty(this, 'include', { get: function() { return definition.include; } });
    Object.defineProperty(this, 'name', { get: function() { return definition.name; } });

    this.isUser = function() {
        return this.name == 'User';
    }

    this.isPublic = function() {
        return this.name == 'Public';
    }

    this.isVirtual = definition.isVirtual;
}

module.exports = BackeryRole;
