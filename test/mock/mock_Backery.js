var _ = require('lodash');

/**
 * Initializes almost full scaled Backery with in-memory Sqlite
 * database. Some complex request might fail, since Sqlite is
 * generally not supported, but it's fine for tests, which require
 * some basic database stuff.
 */
module.exports = function(config, schema) {
    var Backery = require('../../lib/Backery.js');
    var ModelSchema = require('../../lib/model/definition/ModelDefinition.js');
    var SequelizeDatabase = require('../../lib/model/sequelize/SequelizeModel.js');
    
    var modelSchema = new ModelSchema(schema);
    
    var database = new SequelizeDatabase();
    return database.define(modelSchema, 'sqlite://:memory:', { shouldLogQueries: false }, Backery).then(function() {
        var entities = { };
        _.each(modelSchema.entities, function(entitySchema) {
            entities[entitySchema.name] = database.entity(entitySchema.name);
        });
        
        function databaseHook(entityDefinition, type) {
            return function(object, arg1) {
                return Backery.Promise.resolve(object);
            }
        }
        
        database.setDatabaseHooksProvider({
            getDatabaseHooks: function(entityDefinition) {
                return {
                    afterFetch: databaseHook(entityDefinition, 'afterFetch'),
                
                    beforeSave: databaseHook(entityDefinition, 'beforeSave'),
                    afterSave: databaseHook(entityDefinition, 'afterSave'),
                
                    beforeDestroy: databaseHook(entityDefinition, 'beforeDestroy'),
                    afterDestroy: databaseHook(entityDefinition, 'afterDestroy')
                };
            }
        });
    
        Backery.Model = entities;
        return Backery.Promise.resolve(Backery);
    });
}
