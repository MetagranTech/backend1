const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const getIstParts = (date = new Date()) => {
    const shifted = new Date(date.getTime() + IST_OFFSET_MS);
    return {
        year: shifted.getUTCFullYear(),
        month: shifted.getUTCMonth(),
        date: shifted.getUTCDate(),
        day: shifted.getUTCDay()
    };
};

const istMidnightUtc = (year, month, date) =>
    new Date(Date.UTC(year, month, date) - IST_OFFSET_MS);

const getCurrentPayoutWeek = (now = new Date()) => {
    const parts = getIstParts(now);
    const daysSinceMonday = (parts.day + 6) % 7;
    const start = istMidnightUtc(parts.year, parts.month, parts.date - daysSinceMonday);
    const end = new Date(start.getTime() + (7 * DAY_MS));
    return { start, end };
};

const isSundayInIndia = (now = new Date()) => getIstParts(now).day === 0;

const getNextSundayInIndia = (now = new Date()) => {
    const parts = getIstParts(now);
    const daysUntilSunday = (7 - parts.day) % 7;
    return istMidnightUtc(parts.year, parts.month, parts.date + daysUntilSunday);
};

module.exports = { getCurrentPayoutWeek, getNextSundayInIndia, isSundayInIndia };
