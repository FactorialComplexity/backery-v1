var BackerObject = require('../BackerObject.js');

var SequelizeObjectImpl = function(sequelizeInstance, promises) {
    this.sequelizeInstance = sequelizeInstance;
    
    this.Promise = promises.class;
    this.promiseWrap = promises.wrap;
}

SequelizeObjectImpl.prototype.get = function(key) {
    // TODO: handling of special type fields
    return this.sequelizeInstance.get(key);
}

SequelizeObjectImpl.prototype.set = function(key, value) {
    // TODO: handling of special type fields
    return this.sequelizeInstance.set(key, value);
}

SequelizeObjectImpl.prototype.isNew = function() {
    return this.sequelizeInstance.isNewRecord;
}

SequelizeObjectImpl.prototype.isFetched = function() {
    return true; // TODO
}

SequelizeObjectImpl.prototype.fetch = function() {
    var self = this;
    return self.promiseWrap(self.sequelizeInstance.reload(), function(sequelizeInstance) {
        if (sequelizeInstance) {
            return self;
        } else {
            return undefined;
        }
    });
}

SequelizeObjectImpl.prototype.save = function() {
    var self = this;
    return self.promiseWrap(self.sequelizeInstance.save(), function(sequelizeInstance) {
        if (sequelizeInstance) {
            return self;
        } else {
            return undefined;
        }
    });
}

SequelizeObjectImpl.prototype.changed = function(key) {
    return this.sequelizeInstance.changed(key)
}

SequelizeObjectImpl.prototype.destroy = function() {
    return this.promiseWrap(this.sequelizeInstance.destroy());
}

module.exports = SequelizeObjectImpl;
