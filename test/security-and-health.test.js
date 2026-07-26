require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePositiveAmount, validateBookingInput } = require('../src/middleware/validate');
const Service = require('../src/models/Service');
const userController = require('../src/controllers/userController');
const { _test: authTest } = require('../src/controllers/authController');
const { isAllowedOrigin } = require('../src/utils/corsOrigins');

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

test('service schema accepts custom categories and pricing types with safe limits', () => {
    const custom = new Service({
        name: 'Custom service',
        category: 'Solar Panel Care',
        pricingType: 'subscription',
        basePrice: 100
    });
    assert.equal(custom.validateSync(), undefined);

    const invalid = new Service({
        name: 'Invalid',
        category: 'A',
        pricingType: 'X'.repeat(41),
        basePrice: 100
    });
    const error = invalid.validateSync();
    assert.ok(error.errors.category);
    assert.ok(error.errors.pricingType);
});

test('Indian phone normalization accepts mobile numbers and rejects invalid input', () => {
    assert.equal(authTest.normalizePhone('98765 43210'), '+919876543210');
    assert.equal(authTest.normalizePhone('+91-98765-43210'), '+919876543210');
    assert.equal(authTest.normalizePhone('12345'), null);
});

test('customer profile setup accepts a single-line address', async () => {
    const addresses = [];
    const req = {
        body: { street: '12 Anna Nagar, Chennai, Tamil Nadu 600040', isDefault: true },
        user: { addresses, save: async () => undefined }
    };
    const res = responseDouble();
    await userController.addAddress(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(addresses[0].street, req.body.street);
    assert.equal(addresses[0].city, '');
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

test('CORS allows Step In Vercel admin previews without allowing unrelated origins', () => {
    const configured = ['https://admin.stepin.example'];
    assert.equal(
        isAllowedOrigin('https://admin-panel-7x3seuadk-step-in.vercel.app', configured),
        true
    );
    assert.equal(isAllowedOrigin('https://admin.stepin.example', configured), true);
    assert.equal(isAllowedOrigin('https://admin-panel-attacker.vercel.app', configured), false);
    assert.equal(isAllowedOrigin('https://step-in.vercel.app.attacker.example', configured), false);
});
