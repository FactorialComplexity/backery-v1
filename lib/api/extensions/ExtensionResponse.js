var ExtensionResponse = function(resolve, reject) {
    
    var self = this;
    
    this.success = function() {
        var responseData = arguments.length == 1 ? arguments[0] : arguments[1];
        var statusCode = arguments.length == 1 ? 200 : arguments[0];
        
        resolve({
            statusCode: statusCode,
            data: responseData
        });
    }
    
    this.error = function(errorObject) {
        reject(errorObject);
    }
    
    this.done = function(promise) {
        resolve(promise);
    }
}

module.exports = ExtensionResponse;
