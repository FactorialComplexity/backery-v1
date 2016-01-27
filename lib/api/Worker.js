var Worker = function(Backer) {
    this.Backer = Backer;
}

Worker.prototype.process = function(request) {
    var self = this;
    if (request.getValidationError()) {
        return self.Backer.Promise.reject(request.getValidationError());
    } else {
        return request.execute().then(function(response) {
            return self.Backer.Promise.resolve(response.getResponseObject());
        });
    }
}

module.exports = Worker;
