'use strict';

const { resolvePeriod, daysBetween, addDays } = require('../../src/utils/period');
const { percentChange } = require('../../src/services/dashboard.service');

describe('resolvePeriod', () => {
  it('this_month is the whole calendar month, previous is the month before', () => {
    expect(resolvePeriod({ period: 'this_month' }, '2026-11-09')).toEqual({
      key: 'this_month',
      from: '2026-11-01',
      to: '2026-11-30',
      previous: { from: '2026-10-01', to: '2026-10-31' },
    });
  });

  it('last_month crosses the year border and handles February', () => {
    expect(resolvePeriod({ period: 'last_month' }, '2026-01-15')).toMatchObject({
      from: '2025-12-01',
      to: '2025-12-31',
      previous: { from: '2025-11-01', to: '2025-11-30' },
    });
    expect(resolvePeriod({ period: 'last_month' }, '2024-03-10')).toMatchObject({
      from: '2024-02-01',
      to: '2024-02-29',
    });
  });

  it('this_year and last_year use whole calendar years', () => {
    expect(resolvePeriod({ period: 'this_year' }, '2026-11-09')).toMatchObject({
      from: '2026-01-01',
      to: '2026-12-31',
      previous: { from: '2025-01-01', to: '2025-12-31' },
    });
    expect(resolvePeriod({ period: 'last_year' }, '2026-11-09')).toMatchObject({
      from: '2025-01-01',
      to: '2025-12-31',
    });
  });

  it('custom keeps its dates; previous is the same number of days right before', () => {
    expect(resolvePeriod({ period: 'custom', from: '2026-11-10', to: '2026-11-16' })).toEqual({
      key: 'custom',
      from: '2026-11-10',
      to: '2026-11-16',
      previous: { from: '2026-11-03', to: '2026-11-09' },
    });
  });

  it('rejects an unknown period', () => {
    expect(() => resolvePeriod({ period: 'forever' })).toThrow('Unknown period');
  });
});

describe('date helpers', () => {
  it('counts days inclusively and adds days', () => {
    expect(daysBetween('2026-11-01', '2026-11-01')).toBe(1);
    expect(daysBetween('2026-11-01', '2026-11-30')).toBe(30);
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('percentChange', () => {
  it('rounds to one decimal and returns null when the base is zero', () => {
    expect(percentChange('150.00', '100.00')).toBe(50);
    expect(percentChange('50.00', '100.00')).toBe(-50);
    expect(percentChange('10.00', '30.00')).toBe(-66.7);
    expect(percentChange('10.00', '0.00')).toBeNull();
  });
});
