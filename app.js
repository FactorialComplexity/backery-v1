var restify = require('restify');
var nconf = require('nconf');

var ModelDefinition = require('./lib/model/definition/ModelDefinition.js')
var SequelizeModel = require('./lib/model/sequelize/SequelizeModel.js')

nconf.argv().env('_');

if (nconf.get('paths:config')) {
    nconf.file({ file: nconf.get('paths:config') });
}

console.log('Loading model from: ' + nconf.get('paths:model'));

var modelData = require(nconf.get('paths:model'));
var modelDefinition = new ModelDefinition(modelData);

var model = new SequelizeModel();
model.define(modelDefinition, nconf.get('database:uri'), nconf.get('database:options')).then(function() {
    console.log('Model setup completed');
});
