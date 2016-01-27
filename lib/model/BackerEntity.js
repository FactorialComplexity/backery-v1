var BackerEntity = function(definition, impl) {
    var pimpl = impl;
    var that = this;
    
    // Create new instance of the entity of BackerObject type and immediately returns
    this.create = function(values) {
        return pimpl.create(values);
    }
    
    // Fetches an object by id, returns Backer.Promise
    this.get = function(id) {
        return pimpl.get(id);
    }
    
    // Instantly creates and returns an unfetched BackerObject with specified id
    this.ref = function(id, values) {
        return pimpl.ref(id, values);
    }
    
    // Instantly loads and returns BackerObject with preloaded data
    this.load = function(values) {
        return pimpl.load(id);
    }
    
    // Create new BackerQuery instance for the entity and immediately returns
    this.query = function() {
        return pimpl.query();
    }
    
    this.getDefinition = function() {
        return definition;
    }
    
    this.getName = function() {
        return definition.name;
    }
}

module.exports = BackerEntity;
