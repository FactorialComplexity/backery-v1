var restify = require('restify');
var nconf = require('nconf');
var promise = require('promise');

require('promise/lib/rejection-tracking').enable();

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
    
    var album = Backer.Album.create({
        title: 'Sawdust',
        published: true
    });
    
    album.save().then(function() {
        return Backer.Promise.all([
            Backer.Track.create({ title: 'Tranquilize (Feat. Lou Reed)' }).save(),
            Backer.Track.create({ title: 'Shadowplay' }).save(),
            Backer.Track.create({ title: 'All the Pretty Faces' }).save()
        ]);
    }).then(function(tracks) {
        return album.relation('tracks').add(tracks);
    }).then(function() {
        return Backer.Album.get('1');
    }).then(function(albumAgain) {
        return albumAgain.relation('tracks').fetch(2);
    }).then(function(tracksAgain) {
        return album.relation('tracks').remove(tracksAgain);
    }).then(function(tracks) {
        console.log('ok');
    });
    
    // var genre = Backer.Genre.create({
    //     title: 'Dance Rock'
    // });
    //
    // genre.save().then(function() {
    //     album.set('genre', genre);
    //     console.log(album.get('genre').get('title'));
    //
    //     return album.save();
    // }).then(function() {
    //     return Backer.Album.query()
    //         .where({ id: '1' })
    //         .include(['genre'])
    //         .find();
    // }).then(function(albums) {
    //     console.log(albums[0].get('genre').get('title'));
    //     return Backer.Promise.resolve();
    // }).then(function() {
    //     console.log('ok');
    // }, function(error) {
    //     console.log(error);
    // });
});
