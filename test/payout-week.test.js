const test = require('node:test');
const assert = require('node:assert/strict');

const {
    getCurrentPayoutWeek,
    getNextSundayInIndia,
    isSundayInIndia
} = require('../src/utils/payoutWeek');

test('weekly payout window runs Monday to Monday in India', () => {
    const { start, end } = getCurrentPayoutWeek(new Date('2026-07-29T10:00:00.000Z'));
    assert.equal(start.toISOString(), '2026-07-26T18:30:00.000Z');
    assert.equal(end.toISOString(), '2026-08-02T18:30:00.000Z');
});

test('withdrawal is enabled only during Sunday in India', () => {
    assert.equal(isSundayInIndia(new Date('2026-08-01T18:29:59.000Z')), false);
    assert.equal(isSundayInIndia(new Date('2026-08-01T18:30:00.000Z')), true);
    assert.equal(isSundayInIndia(new Date('2026-08-02T18:30:00.000Z')), false);
});

test('next payout date points to Sunday midnight in India', () => {
    assert.equal(
        getNextSundayInIndia(new Date('2026-07-29T10:00:00.000Z')).toISOString(),
        '2026-08-01T18:30:00.000Z'
    );
});
