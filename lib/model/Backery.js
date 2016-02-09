var _ = require('underscore');
var Promise = require('promise');
var BackeryCondition = require('./classes/BackeryCondition.js');

var Backery = module.exports = {
    Promise: Promise
};

_.each(BackeryCondition, function(key, value) {
    Backery[key] = value;
});
