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

nconf.argv().env('_');

if (nconf.get('paths:config')) {
    nconf.file({ file: path.resolve(nconf.get('paths:config')) });
}

console.log('Loading model from: ' + path.resolve(nconf.get('paths:model')));

var modelData = require(path.resolve(nconf.get('paths:model')));
var modelDefinition = new ModelDefinition(modelData);

var model = new SequelizeModel();
var application;

model.define(modelDefinition, nconf.get('database:uri'), nconf.get('database:options'), Backery).then(function() {
    console.log('Model setup completed');

    var entities = { };
    _.each(modelDefinition.entities, function(entityDefinition) {
        entities[entityDefinition.name] = model.entity(entityDefinition.name);
    });
    Backery.Model = entities;
    
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
    
    console.log('Container application initialized successfully');
}, function(error) {
    console.error('Start up failed: ', error.stack);
    process.exit(1);
});
