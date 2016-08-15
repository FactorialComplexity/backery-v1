var apn = require('apn');
var _ = require('lodash');

var PushNotificationsSender = function(config, entities, queue, Backery) {
    this.config = config;
    this.entities = entities;
    this.queue = queue;
    this.Backery = Backery;
    this.apns = { };
    
    var self = this;
    _.each(config.environments.ios, function(env, key) {
        self.apns[key] = new apn.Connection(env);
    });
}

PushNotificationsSender.prototype.start = function() {
    var self = this;
    var Installation = this.entities.Installation;
    var Backery = this.Backery;
    
    setInterval(function() {
        if (!self._processing) {
            self._processing = true;
            self.queue.dequeue(self.config.numberToProcessAtOnce, function(notifications) {
                
                Backery.Promise.all(_.map(notifications, function(notification) {
                    return Installation.query()
                        .where(notification.whereInstallation)
                        .and('platform', 'ios')
                        .and(Backery.NotEq('apnsToken', null))
                        .find()
                    .then(function(installations) {
                        _.each(installations, function(installation) {
                            var apnsConnection = self.apns[installation.get('environment')];
                            
                            if (apnsConnection) {
                                var apnsNotification = new apn.Notification();
                                var recepientDevice = new apn.Device(installation.get('apnsToken'));
                                
                                if (notification.apns) {
                                    apnsNotification.expiry = notification.apns.expiry;
                                    apnsNotification.priority = notification.apns.priority;
                                    apnsNotification.badge = notification.apns.badge;
                                    apnsNotification.sound = notification.apns.sound;
                                    apnsNotification.alert = notification.apns.alert;
                                    apnsNotification.category = notification.apns.category;
                                    apnsNotification.contentAvailable = notification.apns.contentAvailable;
                                    apnsNotification.mdm = notification.apns.mdm;
                                    
                                    if (notification.apns.actionLocKey) {
                                        apnsNotification.setActionLocKey(notification.apns.actionLocKey);
                                    }
                                    
                                    if (notification.apns.locKey) {
                                        apnsNotification.setLocKey(notification.apns.locKey);
                                    }
                                    
                                    if (notification.apns.locArgs) {
                                        apnsNotification.setLocArgs(notification.apns.locArgs);
                                    }
                                    
                                    if (notification.apns.launchImage) {
                                        apnsNotification.setLaunchImage(notification.apns.launchImage);
                                    }
                                    
                                } else {
                                    apnsNotification.contentAvailable = true;
                                }
                                
                                apnsNotification.payload = _.filter(notification, function(value, key) {
                                    return key != 'apns' && key != 'gcm';
                                });
                                
                                apnsConnection.pushNotification(apnsNotification, recepientDevice);
                                
                                console.log('APNS SENT (' + installation.get('environment') + '-' + installation.get('apnsToken')  + '): '+
                                    apnsNotification.compile());
                            } else {
                                console.error('Failed to send notification to APNS environment `' + installation.get('environment') +
                                    '`: environment not configured');
                            }
                        });
                    });
                    
                })).then(function() {
                    self._processing = false;
                });
            });
        }
    }, self.config.loopInterval);
}

module.exports = PushNotificationsSender;
