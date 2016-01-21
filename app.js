var restify = require('restify');
var nconf = require('nconf');
var promise = require('promise');

var ModelDefinition = require('./lib/model/definition/ModelDefinition.js')
var SequelizeModel = require('./lib/model/sequelize/SequelizeModel.js')
var backer = require('./lib/model/Backer.js');

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

    var Backer = backer(model, promise);
    
    Backer.Artist.create({
        title: 'The Killers',
        published: true
    }).save().then(function(artist) {
        return Backer.Artist.get('1');
    }).then(function(artist) {
        console.log(artist);
        return Backer.Artist.query().where({ title: 'The Killers' }).find();
    }).then(function(artists) {
        console.log(artists);
    }, function(error) {
        console.log(error);
    });
});
