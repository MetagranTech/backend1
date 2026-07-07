const test = require('node:test');
const assert = require('node:assert/strict');
const { distanceInKm, isAddressWithinServiceArea } = require('../src/utils/serviceArea');

test('distanceInKm returns zero for the same point', () => {
    assert.equal(distanceInKm(10.7905, 78.7047, 10.7905, 78.7047), 0);
});

test('service area includes a customer inside the configured radius', () => {
    const serviceArea = { coordinates: [78.7047, 10.7905], radiusInKm: 30 };
    const address = { coordinates: { lat: 10.8155, lng: 78.6965 } };
    assert.equal(isAddressWithinServiceArea(serviceArea, address), true);
});

test('service area excludes a customer outside the configured radius', () => {
    const serviceArea = { coordinates: [78.7047, 10.7905], radiusInKm: 15 };
    const address = { coordinates: { lat: 11.0168, lng: 76.9558 } };
    assert.equal(isAddressWithinServiceArea(serviceArea, address), false);
});

test('service area rejects bookings without coordinates', () => {
    assert.equal(isAddressWithinServiceArea({ coordinates: [78.7, 10.7], radiusInKm: 30 }, {}), false);
});
