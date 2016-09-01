var nodemailer = require('nodemailer');

var SMTPMailer = function(config, Backery) {
    var self = this;
    var _transporter = nodemailer.createTransport(config);
    
    this.sendMail = function(mail) {
        return new Backery.Promise(function(resolve, reject) {
            _transporter.sendMail(mail, function(error, info) {
                if (error) {
                    reject(error)
                } else {
                    resolve(info.response)
                }
            });
        });
    }
}

module.exports = SMTPMailer;
