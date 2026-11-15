'use strict';

const {
  labelsFor,
  categoryLabel,
  paymentLabel,
  periodText,
} = require('../../src/utils/exportLabels');

describe('export labels', () => {
  it('keeps the English words of the files as they were', () => {
    const L = labelsFor('en');

    expect(L.date).toBe('Date');
    expect(L.payment).toBe('Payment method');
    expect(L.total(3)).toBe('Total (3 expenses)');
    expect(paymentLabel('en', 'bank_transfer')).toBe('Bank transfer');
    expect(periodText('en', {})).toBe('All dates');
    expect(periodText('en', { from: '2026-11-01' })).toBe('2026-11-01 to today');
  });

  it('knows Arabic, and falls back to English for any other language', () => {
    expect(labelsFor('ar').date).toBe('التاريخ');
    expect(labelsFor('ar').total(3)).toBe('الإجمالي – عدد المصروفات 3');
    expect(labelsFor('fr')).toBe(labelsFor('en'));
    expect(labelsFor(undefined)).toBe(labelsFor('en'));
  });

  it('translates the default categories only in Arabic and keeps custom names', () => {
    expect(categoryLabel('ar', 'Food')).toBe('الطعام');
    expect(categoryLabel('ar', 'Gym')).toBe('Gym');
    expect(categoryLabel('ar', 'constructor')).toBe('constructor');
    expect(categoryLabel('en', 'Food')).toBe('Food');
  });

  it('translates the payment methods in Arabic', () => {
    expect(paymentLabel('ar', 'cash')).toBe('نقدًا');
    expect(paymentLabel('ar', 'mobile_wallet')).toBe('محفظة إلكترونية');
    expect(paymentLabel('ar', 'something_new')).toBe('Something new');
  });

  it('writes the period in Arabic', () => {
    expect(periodText('ar', {})).toBe('كل التواريخ');
    expect(periodText('ar', { from: '2026-11-01', to: '2026-11-30' })).toBe(
      'من 2026-11-01 إلى 2026-11-30',
    );
  });
});
