require('dotenv').config({ path: '/home/node/credentials/.env' })
var nconf = require('nconf');
var path = require('path');
var _ = require('underscore');
var colors = require('colors/safe');

require('console-stamp')(console, {
    pattern: "UTC:yyyy-mm-dd'T'HH:MM:ss.l'Z'",
    label: false,
    colors: {
    	stamp: "yellow"
    }
});

var ModelDefinition = require('./lib/model/definition/ModelDefinition.js');

var REST = require('./lib/rest/REST.js');
var application = require('./lib/application.js');

nconf.argv().env('__');

if (nconf.get('paths:config')) {
    nconf.file({ file: path.resolve(nconf.get('paths:config')) });
}

nconf.env('__');

console.log('Loading schema from: ' + path.resolve(nconf.get('paths:model')));

var modelData = require(path.resolve(nconf.get('paths:model')));
var schema = new ModelDefinition(modelData);

application(nconf, schema).then(function(application) {
    console.log('Application setup completed');

    return application.Backery.Promise.all([
        REST(application, {
            port: nconf.get('rest:port'),
            maxBodySize: nconf.get('rest:maxBodySize'),
            requestContextNamespace: application.getRequestContextNamespace(),
            cookieSecret: nconf.get('rest:cookieSecret')
        }),
        application
        ])
}).spread(function({ httpServer }, application) {
    console.log('Extension code request hooks:');
    _.each(application.getRequestHooks(), function(types, entityName) {
        console.log('  ' + entityName);
        _.each(types, function(type) {
            console.log('    - ' + type);
        });
    });

    console.log('Extension code onListen hooks:');
    application.getOnListenHooks().forEach(hook => hook(httpServer, application))
    console.log('    - ' + application.getOnListenHooks().length + ' hook(s) registered');

    console.log('Extension code database hooks:');
    _.each(application.getDatabaseHooks(), function(types, entityName) {
        console.log('  ' + entityName);
        _.each(types, function(type) {
            console.log('    - ' + type);
        });
    });

    console.log('REST API setup completed, listening to port', colors.green(httpServer.address().port));
    console.log('Container application initialized successfully');
}, function(error) {
    console.error(error);
    console.error('Start up failed: ', error.stack);
    process.exit(1);
});
