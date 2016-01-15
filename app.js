var restify = require('restify');
var nconf = require('nconf');

var ModelDefinition = require('./lib/model/definition/ModelDefinition.js')

nconf.argv().env('_');

console.log('Loading model from: ' + nconf.get('paths:model'));

var modelData = require(nconf.get('paths:model'));
var modelDefinition = new ModelDefinition(modelData);

console.log(modelDefinition);