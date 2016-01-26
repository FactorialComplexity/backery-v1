var nconf = require('nconf');
var promise = require('promise');

require('promise/lib/rejection-tracking').enable();

var ModelDefinition = require('./lib/model/definition/ModelDefinition.js')
var SequelizeModel = require('./lib/model/sequelize/SequelizeModel.js')
var initBacker = require('./lib/model/Backer.js');
var initREST = require('./lib/rest/REST.js');
var Worker = require('./lib/api/Worker.js');

nconf.argv().env('_');

if (nconf.get('paths:config')) {
    nconf.file({ file: nconf.get('paths:config') });
}

console.log('Loading model from: ' + nconf.get('paths:model'));

var modelData = require(nconf.get('paths:model'));
var modelDefinition = new ModelDefinition(modelData);

var model = new SequelizeModel();
model.define(modelDefinition, promise, nconf.get('database:uri'), nconf.get('database:options')).then(function() {
    console.log('Model setup completed');

    var Backer = initBacker(model, promise);
    var worker = new Worker(Backer);
    
    return initREST(nconf.get('rest:port'), nconf.get('application:name'), model.getDefinition(), worker);
}).then(function() {
    console.log('REST API setup completed');
    console.log('Container application initialized successfully');
}, function(error) {
    console.error('Start up failed: ', error.stack);
    process.exit(1);
});
