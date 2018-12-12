const admin = require('firebase-admin');
const path = require('path');
const nconf = require('nconf');

nconf.argv().env('__');

if (nconf.get('paths:config')) {
    nconf.file({ file: path.resolve(nconf.get('paths:config')) });
}

nconf.env('__');

const Firebase = {
    projectId: nconf.get('firebase:projectId'),
    clientEmail: nconf.get('firebase:clientEmail'),
    privetKey: nconf.get('firebase:privetKey').replace(/\\n/g, '\n'),
    databaseUrl: nconf.get('firebase:databaseUrl')
};

admin.initializeApp({
    credential: admin.credential.cert({
        projectId: Firebase.projectId,
        clientEmail: Firebase.clientEmail,
        privateKey: Firebase.privetKey
    }),
});

const Fcm = {
    sendMessage: function (message) {
        console.log('FCM Message:::', message);
        return admin.messaging().send(message)
            .then((response) => {
            // Response is a message ID string.
                console.log('\x1b[34m%s\x1b[0m', 'Successfully sent message:', response);
            })
            .catch((error) => {
                console.log('\x1b[33m%s\x1b[0m', 'Error sending message via FCM service:', error.message);
            });
    }
};

module.exports = Fcm;