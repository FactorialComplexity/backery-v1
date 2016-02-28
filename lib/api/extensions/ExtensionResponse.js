var ExtensionResponse = function(resolve, reject) {
    
    var self = this;
    
    this.success = function(responseObject) {
        resolve(responseObject);
    }
    
    this.error = function(errorObject) {
        reject(errorObject);
    }
}

module.exports = ExtensionResponse;
