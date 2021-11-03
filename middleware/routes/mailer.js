const nodemailer = require('nodemailer');
const config = require('../../config');

//use created gmail
let transporter = nodemailer.createTransport(config.get('nodemailer'))
// let transporter = nodemailer.createTransport({
//     host: 'smtp.ethereal.email',
//     port: 587,
//     secure: false,
//     auth: {
//         user: testEmailAccount.user,
//         pass: testEmailAccount.pass,
//     },
// })

// await transporter.sendMail({
//     from: configGmail.auth.user,
//     to: 'user@example.com, user@example.com',
//     subject: 'Message from Node js',
//     text: 'This message was sent from Node js server.',
//     html:
//         'This <i>message</i> was sent from <strong>Node js</strong> server.',
// })

let serviceEmail = config.get('nodemailer').auth.user
module.exports.sendMail = function(data) {
    return transporter.sendMail({
        from: serviceEmail,
        to: data.to,
        subject: data.subject,
        text: data.text,
        html: data.html,
    })
}