var PEG = require('pegjs');
var fs = require('fs');
var _ = require('underscore');
var errors = require('../utils/errors.js');

var parsing = module.exports = {};

var whereParser = PEG.buildParser(fs.readFileSync(__dirname + '/parsing/where.peg', 'utf8'));

parsing.parseInclude = function(includeString) {
    if (!includeString)
        return;
        
    return _.map(includeString.split(','), function(fieldInclude) {
        var match = /^([a-zA-Z][a-zA-Z0-9\_]*)(\(([0-9]+)\;([0-9]+)\))?$/.exec(fieldInclude);
        if (match) {
            if (!_.isUndefined(match[3])) {
                return _.object([[ match[1], { offset: parseInt(match[3]), limit: parseInt(match[4]) } ]]);
            } else {
                return match[1];
            }
        } else {
            throw new errors.BackeryInvalidParametersError('Invalid include string');
        }
    });
}

parsing.parseSort = function(sortString) {
    if (!sortString)
        return;
        
    return _.map(sortString.split(','), function(fieldSort) {
        var match = /^([a-zA-Z][a-zA-Z0-9\_]*)(\((asc|desc)\))?$/.exec(fieldSort);
        if (match) {
            if (!_.isUndefined(match[3])) {
                return _.object([[ match[1], match[3] ]]);
            } else {
                return match[1];
            }
        } else {
            throw new errors.BackeryInvalidParametersError('Invalid sort string');
        }
    });
}

parsing.parseWhere = function(whereString) {
    if (!whereString)
        return;
    
    try {
        return whereParser.parse(whereString);
    } catch (error) {
        throw new errors.BackeryInvalidParametersError('Invalid where string: ' + error.message);
    }
}