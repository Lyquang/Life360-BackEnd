const DAY_MS = 24 * 60 * 60 * 1000;

/** Local-time day range. `date` is "YYYY-MM-DD"; defaults to today (server TZ). */
function localDayRange(date, now = new Date()) {
  const start = date
    ? new Date(...date.split('-').map((part, i) => Number(part) - (i === 1 ? 1 : 0)))
    : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

// toISOString() would shift local midnight to the previous UTC day.
function formatLocalDate(d) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function isValidCalendarDate(date) {
  const [y, m, d] = date.split('-').map(Number);
  const parsed = new Date(y, m - 1, d);
  return parsed.getFullYear() === y && parsed.getMonth() === m - 1 && parsed.getDate() === d;
}

module.exports = { localDayRange, formatLocalDate, isValidCalendarDate };
