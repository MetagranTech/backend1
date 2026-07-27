const CLOCK_TIME = /(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/gi;

const parseClockTime = (value) => {
    const matches = [...String(value || '').matchAll(CLOCK_TIME)];
    if (matches.length === 0) return null;

    // A range expires at its end; a single selected time expires at that time.
    const [, hourText, minuteText = '0', meridiem] = matches[matches.length - 1];
    let hour = Number(hourText) % 12;
    if (meridiem.toUpperCase() === 'PM') hour += 12;
    return { hour, minute: Number(minuteText) };
};

const getBookingExpiry = (booking) => {
    const scheduledDate = new Date(booking?.scheduledDate);
    if (Number.isNaN(scheduledDate.getTime())) return null;

    const clockTime = parseClockTime(booking?.timeSlot);
    if (!clockTime) {
        // Keep an unparseable slot visible until the end of its scheduled day.
        return new Date(scheduledDate.getTime() + (24 * 60 * 60 * 1000));
    }

    return new Date(
        scheduledDate.getTime()
        + (clockTime.hour * 60 * 60 * 1000)
        + (clockTime.minute * 60 * 1000)
    );
};

const isBookingRequestPast = (booking, now = new Date()) => {
    const expiry = getBookingExpiry(booking);
    return expiry != null && expiry.getTime() <= now.getTime();
};

module.exports = { getBookingExpiry, isBookingRequestPast };
