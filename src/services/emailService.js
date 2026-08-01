const nodemailer = require('nodemailer');

let transporter;

const getTransporter = () => {
    if (transporter) return transporter;
    const user = process.env.OTP_EMAIL_USER;
    const pass = process.env.OTP_EMAIL_APP_PASSWORD;
    if (!user || !pass) {
        const error = new Error('Email OTP service is not configured');
        error.status = 503;
        throw error;
    }
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass }
    });
    return transporter;
};

exports.sendRegistrationOtp = async ({ email, name, otp }) => {
    const safeName = String(name).replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
    await getTransporter().sendMail({
        from: `Home Step In <${process.env.OTP_EMAIL_USER}>`,
        to: email,
        subject: 'Your Home Step In verification code',
        text: `Hi ${name}, your Home Step In verification code is ${otp}. It expires in 10 minutes. Do not share this code with anyone.`,
        html: `<p>Hi ${safeName},</p><p>Your Home Step In verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${otp}</p><p>This code expires in 10 minutes. Do not share it with anyone.</p>`
    });
};
