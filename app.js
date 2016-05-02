var nconf = require('nconf');
var path = require('path');
var _ = require('underscore');

require('console-stamp')(console, {
    pattern: "UTC:yyyy-mm-dd'T'HH:MM:ss.l'Z'",
    label: false,
    colors: {
    	stamp: "yellow"
    }
});


var ModelDefinition = require('./lib/model/definition/ModelDefinition.js')
var SequelizeModel = require('./lib/model/sequelize/SequelizeModel.js')
var Backery = require('./lib/Backery.js');
var Application = require('./lib/api/Application.js');
var initREST = require('./lib/rest/REST.js');

var availableFileManagers = {
    's3': require('./lib/model/files/S3FileManager.js')
}

nconf.argv().env('__');

if (nconf.get('paths:config')) {
    nconf.file({ file: path.resolve(nconf.get('paths:config')) });
}

nconf.env('__');

console.log('Loading model from: ' + path.resolve(nconf.get('paths:model')));

var modelData = require(path.resolve(nconf.get('paths:model')));
var modelDefinition = new ModelDefinition(modelData);

var model = new SequelizeModel();
var application;

model.define(modelDefinition, nconf.get('database:uri'),
    _.extend(nconf.get('database:options'), { shouldLogQueries: true }), Backery).then(function() {
    console.log('Model setup completed');

    var entities = { };
    _.each(modelDefinition.entities, function(entityDefinition) {
        entities[entityDefinition.name] = model.entity(entityDefinition.name);
    });
    
    if (nconf.get('files')) {
        var filesConfig = nconf.get('files');
        _.each(filesConfig, function(value, key) {
            var Manager = availableFileManagers[key];
            manager = new Manager(filesConfig[key], Backery);
            model.registerFileManager(manager, filesConfig[key].default);
        });
    } else {
       reject(new Error('Default file manager is not defined'));
    }
    
    Backery.Model = entities;
    
    // Wrap Backery.Struct functions that require model with wrappers, providing model object
    Backery.Struct.fromJSON = _.partial(Backery.Struct.fromJSON, _, _, model);
    
    application = new Application(nconf, model, Backery);
    
    return initREST(application, {
        port: nconf.get('rest:port'),
        maxBodySize: nconf.get('rest:maxBodySize')
    });
}).then(function(info) {
    console.log('REST API setup completed, listening to port %s', info.address.port);
    
    console.log('Extension code request hooks:');
    _.each(application.getRequestHooks(), function(types, entityName) {
        console.log('  ' + entityName);
        _.each(types, function(type) {
            console.log('    - ' + type);
        });
    });
    
    console.log('Extension code database hooks:');
    _.each(application.getDatabaseHooks(), function(types, entityName) {
        console.log('  ' + entityName);
        _.each(types, function(type) {
            console.log('    - ' + type);
        });
    });
    
    console.log('Container application initialized successfully');
}, function(error) {
    console.error(error);
    console.error('Start up failed: ', error.stack);
    process.exit(1);
});
