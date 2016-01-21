var errors = require('./utils/errors.js');

var BackerObject = function(impl, isRef) {
    //this.isRef = isRef;
    
    var pimpl = impl;
    var that = this;
    
    // Returns the current value of the specified key
    this.get = function(key) {
        // if (this.isRef)
        //     throw new errors.BackerError('BackerObject is a reference and cannot');
        
        return pimpl.get(key);
    }
    
    // Sets value for a specified key
    this.set = function(key, value) {
        return pimpl.set(key, value);
    }
    
    // Returns true if object was never saved to persistent storage
    this.isNew = function() {
        return pimpl.isNew();
    }
    
    // Returns true if object doesn't contain any data
    this.isFetched = function() {
        return pimpl.isFetched();
    }
    
    // Fetches object data from the perstistent storage, discarding any updates made to the object.
    // Returns Backer.Promise
    this.fetch = function() {
        return pimpl.fetch();
    }
    
    // Fetches object data from the perstistent storage, discarding any updates made to the object.
    // Returns Backer.Promise
    this.save = function() {
        return pimpl.save();
    }
    
    // Returns true if value for the key was changed but was not persisted in the database yet
    this.changed = function(key) {
        return pimpl.changed(key);
    }
    
    // Deletes the object from the resistent storage. Returns Backer.Promise
    this.destroy = function() {
        return pimpl.destroy();
    }
}

module.exports = BackerObject;
