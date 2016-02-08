var changeCase = require('change-case');

module.exports.toUpperCaseFirstLetter = function(name) {
    return name.substring(0, 1).toUpperCase() + name.substring(1);
}

module.exports.toURLCase = function(name) {
    return changeCase.paramCase(name);
}
