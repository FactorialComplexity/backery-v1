var PEG = require('pegjs');
var fs = require('fs');
var _ = require('underscore');
var errors = require('../utils/errors.js');

var parsing = module.exports = {};

var whereParser = PEG.buildParser(fs.readFileSync(__dirname + '/parsing/where.peg', 'utf8'));
var includeParser = PEG.buildParser(fs.readFileSync(__dirname + '/parsing/include.peg', 'utf8'));

parsing.parseInclude = function(includeString) {
    if (!includeString)
        return;
    
    try {
        return includeParser.parse(includeString);
    } catch (error) {
        throw new errors.BackeryInvalidParametersError('Invalid include string: ' + error.message);
    }
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
