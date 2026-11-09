'use strict';

const { today, monthRange, yearRange, fromISODate, toISODate } = require('./dateHelpers');

const PERIODS = ['this_month', 'last_month', 'this_year', 'last_year', 'custom'];

const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (isoDate, days) =>
  toISODate(new Date(fromISODate(isoDate).getTime() + days * DAY_MS));
const daysBetween = (from, to) => Math.round((fromISODate(to) - fromISODate(from)) / DAY_MS) + 1;

/** [year, month] of the month before (year, month). */
const previousMonth = (year, month) => (month === 1 ? [year - 1, 12] : [year, month - 1]);

/**
 * Turn a period name into dates, plus the period right before it (used for "compared with
 * the previous period"). All dates are "YYYY-MM-DD" strings, both ends inclusive.
 *   this_month / last_month : the whole calendar month; previous = the month before it
 *   this_year / last_year   : the whole calendar year;  previous = the year before it
 *   custom                  : from and to; previous = the same number of days right before
 * `now` can be passed in tests.
 */
function resolvePeriod({ period = 'this_month', from, to } = {}, now = today()) {
  const [year, month] = now.split('-').map(Number);

  if (period === 'this_month' || period === 'last_month') {
    const [y, m] = period === 'this_month' ? [year, month] : previousMonth(year, month);
    const [py, pm] = previousMonth(y, m);
    return { key: period, ...monthRange(y, m), previous: monthRange(py, pm) };
  }
  if (period === 'this_year' || period === 'last_year') {
    const y = period === 'this_year' ? year : year - 1;
    return { key: period, ...yearRange(y), previous: yearRange(y - 1) };
  }
  if (period === 'custom') {
    const length = daysBetween(from, to);
    return {
      key: 'custom',
      from,
      to,
      previous: { from: addDays(from, -length), to: addDays(from, -1) },
    };
  }
  throw new Error(`Unknown period: ${period}`);
}

module.exports = { PERIODS, resolvePeriod, daysBetween, addDays };
