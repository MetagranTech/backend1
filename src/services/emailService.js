exports.sendRegistrationOtp = async ({ email, name, otp }) => {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.OTP_EMAIL_USER;
    if (!apiKey || !senderEmail) {
        const error = new Error('Email OTP service is not configured');
        error.status = 503;
        throw error;
    }
    const safeName = String(name).replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response;
    try {
        response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: { name: 'Home Step In', email: senderEmail },
                to: [{ email, name }],
                subject: 'Your Home Step In verification code',
                textContent: `Hi ${name}, your Home Step In verification code is ${otp}. It expires in 10 minutes. Do not share this code with anyone.`,
                htmlContent: `<p>Hi ${safeName},</p><p>Your Home Step In verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${otp}</p><p>This code expires in 10 minutes. Do not share it with anyone.</p>`
            }),
            signal: controller.signal
        });
    } catch (cause) {
        const error = new Error(cause.name === 'AbortError'
            ? 'Email provider timed out. Please try again.'
            : 'Unable to connect to the email provider');
        error.status = 502;
        throw error;
    } finally {
        clearTimeout(timeout);
    }
    if (!response.ok) {
        const details = await response.json().catch(() => ({}));
        const error = new Error(details.message || 'Email provider rejected the OTP message');
        error.status = 502;
        throw error;
    }
    return response.json().catch(() => ({ messageId: null }));
};
