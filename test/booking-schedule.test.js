const test = require('node:test');
const assert = require('node:assert/strict');

const { getBookingExpiry, isBookingRequestPast } = require('../src/utils/bookingSchedule');

test('range requests expire at the end of the selected slot', () => {
    const booking = {
        scheduledDate: '2026-07-26T18:30:00.000Z',
        timeSlot: '10:00 AM - 12:00 PM'
    };

    assert.equal(getBookingExpiry(booking).toISOString(), '2026-07-27T06:30:00.000Z');
    assert.equal(isBookingRequestPast(booking, new Date('2026-07-27T06:29:59.000Z')), false);
    assert.equal(isBookingRequestPast(booking, new Date('2026-07-27T06:30:00.000Z')), true);
});

test('single-time requests expire at the selected time', () => {
    const booking = {
        scheduledDate: '2026-07-26T18:30:00.000Z',
        timeSlot: '7:15 PM'
    };

    assert.equal(getBookingExpiry(booking).toISOString(), '2026-07-27T13:45:00.000Z');
});

test('unparseable slots remain visible until the scheduled day ends', () => {
    const booking = {
        scheduledDate: '2026-07-26T18:30:00.000Z',
        timeSlot: 'Flexible'
    };

    assert.equal(getBookingExpiry(booking).toISOString(), '2026-07-27T18:30:00.000Z');
});
