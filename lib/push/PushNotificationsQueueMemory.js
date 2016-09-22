var PushNotificationsQueueMemory = function() {
    this.data = [];
}

PushNotificationsQueueMemory.prototype.enqueue = function(whereInstallation, payload) {
    this.data.push({
        whereInstallation: whereInstallation,
        payload: payload
    });
}

PushNotificationsQueueMemory.prototype.dequeue = function(limit, callback) {
    var self = this;
    process.nextTick(function() {
        var result = self.data.splice(0, Math.min(limit, self.data.length));
        callback(result);
    });
}

module.exports = PushNotificationsQueueMemory;
