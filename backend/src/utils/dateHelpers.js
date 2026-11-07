'use strict';

/**
 * Date helpers. Transaction dates are calendar dates (no time), so everything here works
 * with "YYYY-MM-DD" strings and UTC arithmetic. That avoids server time-zone surprises.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n) => String(n).padStart(2, '0');

const toISODate = (date) => date.toISOString().slice(0, 10);
const fromISODate = (str) => new Date(`${str}T00:00:00.000Z`);

function isValidISODate(str) {
  if (typeof str !== 'string' || !ISO_DATE.test(str)) return false;
  const d = fromISODate(str);
  return !Number.isNaN(d.getTime()) && toISODate(d) === str; // rejects 2026-02-31
}

const today = () => toISODate(new Date());

const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** First and last day of a month (month is 1-12). */
function monthRange(year, month) {
  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(daysInMonth(year, month))}`,
  };
}

function yearRange(year) {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

/**
 * Next run date for a recurring transaction.
 * Monthly/yearly keep the original day when they can: pass the template's start date as
 * `anchorDay` source so Jan 31 -> Feb 28 -> Mar 31 (not Mar 28).
 */
function addInterval(isoDate, frequency, anchorIsoDate = isoDate) {
  const d = fromISODate(isoDate);
  const anchorDay = fromISODate(anchorIsoDate).getUTCDate();

  switch (frequency) {
    case 'daily':
      d.setUTCDate(d.getUTCDate() + 1);
      return toISODate(d);
    case 'weekly':
      d.setUTCDate(d.getUTCDate() + 7);
      return toISODate(d);
    case 'monthly': {
      const y = d.getUTCFullYear() + Math.floor((d.getUTCMonth() + 1) / 12);
      const m = (d.getUTCMonth() + 1) % 12; // 0-based
      return `${y}-${pad(m + 1)}-${pad(Math.min(anchorDay, daysInMonth(y, m + 1)))}`;
    }
    case 'yearly': {
      const y = d.getUTCFullYear() + 1;
      const m = d.getUTCMonth() + 1;
      return `${y}-${pad(m)}-${pad(Math.min(anchorDay, daysInMonth(y, m)))}`;
    }
    default:
      throw new Error(`Unknown frequency: ${frequency}`);
  }
}

module.exports = {
  isValidISODate,
  toISODate,
  fromISODate,
  today,
  daysInMonth,
  monthRange,
  yearRange,
  addInterval,
};
