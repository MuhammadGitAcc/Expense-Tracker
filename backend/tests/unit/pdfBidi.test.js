'use strict';

const { visualRuns } = require('../../src/utils/pdfBidi');

const texts = (value) => visualRuns(value).map((run) => run.text);

describe('visualRuns (the reading order of Arabic text in the PDF)', () => {
  it('gives nothing for an empty text', () => {
    expect(visualRuns('')).toEqual([]);
    expect(visualRuns(undefined)).toEqual([]);
  });

  it('keeps one Arabic phrase as one run', () => {
    expect(texts('حساب البيت')).toEqual(['حساب البيت']);
  });

  it('puts numbers and English left to right inside Arabic text', () => {
    // Read from the right: the Arabic words, then 123, then abc.
    expect(texts('حساب البيت 123 abc')).toEqual(['abc', ' ', '123', 'حساب البيت ']);
  });

  it('shows the total line with the count at the left end', () => {
    expect(texts('الإجمالي – عدد المصروفات 5')).toEqual(['5', 'الإجمالي – عدد المصروفات ']);
  });
});
