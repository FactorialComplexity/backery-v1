var _ = require('underscore');
var Promise = require('promise');
var BackeryCondition = require('./model/classes/BackeryCondition.js');
var Struct = require('./api/BackeryStruct.js');
var Promise = require('promise');

require('promise/lib/rejection-tracking').enable();

var Backery = module.exports = {
    Promise: Promise,
    Struct: Struct
};

_.each(BackeryCondition, function(key, value) {
    Backery[key] = value;
});
