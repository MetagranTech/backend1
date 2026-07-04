const axios = require('axios');
const crypto = require('crypto');

const provider = () => (process.env.OTP_PROVIDER || (process.env.NODE_ENV === 'production' ? 'msg91' : 'test')).toLowerCase();
const otpHash = (otp) => crypto.createHmac('sha256', process.env.JWT_SECRET).update(String(otp)).digest('hex');

const assertMsg91Config = () => {
    if (!process.env.MSG91_AUTH_KEY || !process.env.MSG91_WIDGET_ID) {
        const error = new Error('MSG91 OTP provider is not configured');
        error.status = 503;
        throw error;
    }
};

exports.send = async (phone) => {
    const selected = provider();
    if (selected === 'test') {
        if (process.env.NODE_ENV === 'production') throw Object.assign(new Error('Test OTP provider is disabled in production'), { status: 503 });
        const otp = process.env.OTP_TEST_CODE || '123456';
        return { provider: 'test', requestId: crypto.randomUUID(), testOtpHash: otpHash(otp), testOtp: otp };
    }
    if (selected !== 'msg91') throw Object.assign(new Error(`Unsupported OTP provider: ${selected}`), { status: 503 });
    assertMsg91Config();
    const response = await axios.post('https://api.msg91.com/api/v5/widget/sendOtp', {
        widgetId: process.env.MSG91_WIDGET_ID,
        identifier: phone.replace(/^\+/, '')
    }, { headers: { authkey: process.env.MSG91_AUTH_KEY, 'content-type': 'application/json' }, timeout: 15000 });
    const requestId = response.data?.reqId || response.data?.requestId || response.data?.message;
    if (!requestId || response.data?.type === 'error') throw Object.assign(new Error(response.data?.message || 'OTP provider rejected the request'), { status: 502 });
    return { provider: 'msg91', requestId: String(requestId) };
};

exports.verify = async (challenge, otp) => {
    if (challenge.provider === 'test') return crypto.timingSafeEqual(Buffer.from(otpHash(otp)), Buffer.from(challenge.testOtpHash));
    assertMsg91Config();
    const response = await axios.post('https://api.msg91.com/api/v5/widget/verifyOtp', {
        widgetId: process.env.MSG91_WIDGET_ID,
        reqId: challenge.providerRequestId,
        otp: String(otp)
    }, { headers: { authkey: process.env.MSG91_AUTH_KEY, 'content-type': 'application/json' }, timeout: 15000 });
    const data = response.data || {};
    return data.type === 'success' || Boolean(data['access-token'] || data.accessToken) || /verified|success/i.test(String(data.message || ''));
};
