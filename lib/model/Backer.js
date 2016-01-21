var _ = require('underscore');

module.exports = function(model, promise) {
    var definition = model.getDefinition();
    
    var Backer = {
        Promise: promise
    };
    
    _.each(definition.entities, function(entityDefinition) {
        Backer[entityDefinition.name] = model.entity(entityDefinition.name);
    });
    
    return Backer;
}
