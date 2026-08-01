const test = require('node:test');
const assert = require('node:assert/strict');
const { sendRegistrationOtp } = require('../src/services/emailService');

test('email OTP uses Brevo HTTPS API with the configured sender', async () => {
    const originalFetch = global.fetch;
    const originalKey = process.env.BREVO_API_KEY;
    const originalSender = process.env.OTP_EMAIL_USER;
    let request;
    process.env.BREVO_API_KEY = 'test-key';
    process.env.OTP_EMAIL_USER = 'sender@example.com';
    global.fetch = async (url, options) => {
        request = { url, options };
        return { ok: true, json: async () => ({ messageId: 'test-message' }) };
    };
    try {
        const result = await sendRegistrationOtp({ email: 'user@example.com', name: 'User', otp: '123456' });
        assert.equal(result.messageId, 'test-message');
        assert.equal(request.url, 'https://api.brevo.com/v3/smtp/email');
        assert.equal(request.options.headers['api-key'], 'test-key');
        const body = JSON.parse(request.options.body);
        assert.equal(body.sender.email, 'sender@example.com');
        assert.equal(body.to[0].email, 'user@example.com');
        assert.match(body.textContent, /123456/);
    } finally {
        global.fetch = originalFetch;
        if (originalKey == null) delete process.env.BREVO_API_KEY; else process.env.BREVO_API_KEY = originalKey;
        if (originalSender == null) delete process.env.OTP_EMAIL_USER; else process.env.OTP_EMAIL_USER = originalSender;
    }
});
