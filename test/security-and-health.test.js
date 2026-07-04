require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePositiveAmount, validateBookingInput } = require('../src/middleware/validate');
const Service = require('../src/models/Service');
const { _test: authTest } = require('../src/controllers/authController');
const otpService = require('../src/services/otpService');

const responseDouble = () => {
    const result = { statusCode: 200, payload: null };
    result.status = (code) => { result.statusCode = code; return result; };
    result.json = (payload) => { result.payload = payload; return result; };
    return result;
};

test('payout validation rejects negative and zero amounts', () => {
    for (const amount of [-100, 0, 'not-a-number']) {
        const res = responseDouble();
        let called = false;
        validatePositiveAmount({ body: { amount } }, res, () => { called = true; });
        assert.equal(called, false);
        assert.equal(res.statusCode, 400);
    }
});

test('booking validation rejects past schedules and invalid service ids', () => {
    const res = responseDouble();
    validateBookingInput({ body: { serviceId: 'bad', address: {}, scheduledDate: '2020-01-01', timeSlot: '10 AM' } }, res, () => assert.fail('next should not run'));
    assert.equal(res.statusCode, 400);
});

test('service schema rejects unsupported categories', () => {
    const service = new Service({ name: 'Invalid', category: 'Unknown', basePrice: 100 });
    const error = service.validateSync();
    assert.ok(error.errors.category);
});

test('Indian phone normalization accepts mobile numbers and rejects invalid input', () => {
    assert.equal(authTest.normalizePhone('98765 43210'), '+919876543210');
    assert.equal(authTest.normalizePhone('+91-98765-43210'), '+919876543210');
    assert.equal(authTest.normalizePhone('12345'), null);
});

test('development OTP provider verifies only the configured code', async () => {
    const previousProvider = process.env.OTP_PROVIDER;
    const previousCode = process.env.OTP_TEST_CODE;
    process.env.OTP_PROVIDER = 'test';
    process.env.OTP_TEST_CODE = '654321';
    try {
        const sent = await otpService.send('+919876543210');
        const challenge = { provider: 'test', testOtpHash: sent.testOtpHash };
        assert.equal(await otpService.verify(challenge, '654321'), true);
        assert.equal(await otpService.verify(challenge, '111111'), false);
    } finally {
        if (previousProvider === undefined) delete process.env.OTP_PROVIDER; else process.env.OTP_PROVIDER = previousProvider;
        if (previousCode === undefined) delete process.env.OTP_TEST_CODE; else process.env.OTP_TEST_CODE = previousCode;
    }
});

test('health route responds without database access', async () => {
    const app = require('../src/app');
    const layer = app.router.stack.find((item) => item.route?.path === '/health');
    assert.ok(layer);
    const res = responseDouble();
    await layer.route.stack[0].handle({}, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.status, 'OK');
});
