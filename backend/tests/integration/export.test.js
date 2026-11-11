'use strict';

const ExcelJS = require('exceljs');
const env = require('../../src/config/env');
const exportService = require('../../src/services/export.service');
const {
  api,
  url,
  authHeader,
  registerUser,
  resetDatabase,
  seedDefaultCategories,
  closeDatabase,
} = require('../helpers');

beforeEach(async () => {
  await resetDatabase();
  await seedDefaultCategories();
});
afterAll(async () => {
  await closeDatabase();
});

const as = (token, method, path, body) => {
  const req = api()[method](url(path)).set(authHeader(token));
  return body === undefined ? req : req.send(body);
};
const makeAccount = async (token, body) =>
  (await as(token, 'post', '/accounts', body)).body.data.account;
const categoryNamed = async (token, name, type) =>
  (await as(token, 'get', '/categories')).body.data.categories.find(
    (c) => c.name === name && c.type === type,
  );
const makeCategory = async (token, name) =>
  (await as(token, 'post', '/categories', { name, type: 'expense' })).body.data.category;

/** A user with a Wallet (USD) and the default Food category plus a custom Rent category. */
async function setup(overrides) {
  const { accessToken: token, user } = await registerUser(overrides);
  const wallet = await makeAccount(token, { name: 'Wallet', balance: '5000' });
  const food = await categoryNamed(token, 'Food', 'expense');
  const rent = await makeCategory(token, 'Rent');
  return { token, user, wallet, food, rent };
}

const spend = (ctx, body) =>
  as(ctx.token, 'post', '/expenses', {
    accountId: ctx.wallet.id,
    categoryId: ctx.food.id,
    amount: '10.00',
    date: '2026-11-03',
    ...body,
  });

/** supertest keeps downloads as raw bytes with this parser. */
const binary = (res, callback) => {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
};
const download = (token, query = '') =>
  api()
    .get(url(`/exports/expenses${query}`))
    .set(authHeader(token))
    .buffer(true)
    .parse(binary);

/** The CSV as rows of cells (the tests only use simple quoting). */
const csvLines = (res) => res.body.subarray(3).toString('utf8').trimEnd().split('\r\n');

async function readXlsx(res) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(res.body);
  return workbook.getWorksheet('Expenses');
}

describe('GET /exports/expenses: access and validation', () => {
  it('needs a login', async () => {
    expect((await api().get(url('/exports/expenses'))).status).toBe(401);
  });

  it('rejects an unknown format and bad filters (400)', async () => {
    const { token } = await setup();

    expect((await as(token, 'get', '/exports/expenses?format=docx')).status).toBe(400);
    expect((await as(token, 'get', '/exports/expenses?from=2026-12-01&to=2026-11-01')).status).toBe(
      400,
    );
    expect((await as(token, 'get', '/exports/expenses?from=nope')).status).toBe(400);
  });

  it('refuses an export with more rows than the limit and says how to fix it', async () => {
    const ctx = await setup();
    await spend(ctx, {});
    await spend(ctx, {});
    await spend(ctx, {});
    const original = exportService.LIMITS.maxRows;
    exportService.LIMITS.maxRows = 2;
    try {
      const res = await as(ctx.token, 'get', '/exports/expenses');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('3 expenses');
      expect(res.body.message).toContain('Narrow the date range');
    } finally {
      exportService.LIMITS.maxRows = original;
    }
  });
});

describe('CSV', () => {
  it('is a download with the right headers and a UTF-8 byte order mark', async () => {
    const ctx = await setup();
    await spend(ctx, { note: 'Lunch' });

    const res = await download(ctx.token, '?format=csv&from=2026-11-01&to=2026-11-30');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="expenses_2026-11-01_to_2026-11-30.csv"',
    );
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.body.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  });

  it('is the default format and lists header and rows, newest first', async () => {
    const ctx = await setup();
    await spend(ctx, {
      amount: '12.50',
      date: '2026-11-03',
      note: 'Lunch',
      tags: ['work', 'food'],
    });
    await spend(ctx, { amount: '99.00', date: '2026-11-05', categoryId: ctx.rent.id });

    const res = await download(ctx.token);

    expect(res.headers['content-type']).toContain('text/csv');
    expect(csvLines(res)).toEqual([
      'Date,Amount,Currency,Category,Account,Payment method,Tags,Note',
      '2026-11-05,99.00,USD,Rent,Wallet,Cash,,',
      '2026-11-03,12.50,USD,Food,Wallet,Cash,"work, food",Lunch',
    ]);
  });

  it('quotes commas, quotes and line breaks, and keeps Arabic text', async () => {
    const ctx = await setup();
    await spend(ctx, { note: 'Said "hi", then\nleft' });
    await spend(ctx, { note: 'قهوة', date: '2026-11-04' });

    const res = await download(ctx.token);

    const text = res.body.toString('utf8');
    expect(text).toContain('"Said ""hi"", then\nleft"');
    expect(text).toContain(',قهوة');
  });

  it('neutralizes formulas (CSV injection) in text cells', async () => {
    const ctx = await setup();
    await spend(ctx, { note: '=HYPERLINK("http://evil.example","click")' });
    await spend(ctx, { note: '+1+1', date: '2026-11-04' });
    await spend(ctx, { note: '@SUM(A1)', date: '2026-11-05' });

    const res = await download(ctx.token);

    const cells = res.body.toString('utf8');
    expect(cells).toContain(`"'=HYPERLINK(""http://evil.example"",""click"")"`);
    expect(cells).toContain(",'+1+1");
    expect(cells).toContain(",'@SUM(A1)");
  });

  it('applies the same filters as the list and never includes other users', async () => {
    const alice = await setup({ email: 'alice@example.com' });
    const bob = await setup({ email: 'bob@example.com' });
    await spend(alice, { amount: '1.00', date: '2026-11-03', note: 'keep me' });
    await spend(alice, { amount: '2.00', date: '2026-10-03', note: 'too early' });
    await spend(alice, { amount: '3.00', date: '2026-11-04', categoryId: alice.rent.id });
    await spend(bob, { amount: '4.00', date: '2026-11-03', note: 'bobs secret' });

    const byDate = await download(
      alice.token,
      '?from=2026-11-01&to=2026-11-30&categoryId=' + alice.food.id,
    );
    const bySearch = await download(alice.token, '?search=early');

    expect(csvLines(byDate)).toHaveLength(2); // header + "keep me"
    expect(byDate.body.toString('utf8')).toContain('keep me');
    expect(csvLines(bySearch)[1]).toContain('too early');
    expect((await download(alice.token)).body.toString('utf8')).not.toContain('bobs secret');
  });

  it('is a valid, empty file when nothing matches', async () => {
    const { token } = await setup();

    const res = await download(token);

    expect(res.status).toBe(200);
    expect(csvLines(res)).toEqual([
      'Date,Amount,Currency,Category,Account,Payment method,Tags,Note',
    ]);
  });
});

describe('Excel', () => {
  it('has a header, typed cells and an exact total per currency', async () => {
    const ctx = await setup();
    const euro = await makeAccount(ctx.token, {
      name: 'Euro wallet',
      balance: '100',
      currency: 'EUR',
    });
    await spend(ctx, { amount: '0.10', date: '2026-11-03', note: 'a' });
    await spend(ctx, { amount: '0.20', date: '2026-11-04', note: 'b' });
    await spend(ctx, { amount: '5.00', date: '2026-11-05', accountId: euro.id });

    const res = await download(ctx.token, '?format=xlsx&sortOrder=asc');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="expenses_.*\.xlsx"$/,
    );
    const sheet = await readXlsx(res);
    expect(sheet.getRow(1).values.slice(1)).toEqual([
      'Date',
      'Amount',
      'Currency',
      'Category',
      'Account',
      'Payment method',
      'Tags',
      'Note',
    ]);
    const first = sheet.getRow(2);
    expect(first.getCell(1).value).toEqual(new Date('2026-11-03T00:00:00.000Z'));
    expect(first.getCell(2).value).toBe(0.1);
    expect(first.getCell(3).value).toBe('USD');
    expect(first.getCell(8).value).toBe('a');

    // rows 2-4 are the data, row 5 is blank, rows 6-7 are the totals (EUR, USD)
    expect(sheet.getRow(6).getCell(3).value).toBe('EUR');
    expect(sheet.getRow(6).getCell(2).value).toBe(5);
    expect(sheet.getRow(7).getCell(3).value).toBe('USD');
    expect(sheet.getRow(7).getCell(2).value).toBe(0.3); // exactly 0.30, not 0.30000000000000004
    expect(sheet.getRow(7).getCell(4).value).toBe('Total (2 expenses)');
  });

  it('keeps text that looks like a formula as plain text', async () => {
    const ctx = await setup();
    await spend(ctx, { note: '=1+1' });

    const sheet = await readXlsx(await download(ctx.token, '?format=xlsx'));

    expect(sheet.getRow(2).getCell(8).value).toBe('=1+1');
    expect(sheet.getRow(2).getCell(8).type).toBe(ExcelJS.ValueType.String);
  });
});

describe('PDF', () => {
  const pageCount = (buffer) =>
    (buffer.toString('latin1').match(/\/Type \/Page(?!s)/g) || []).length;

  it('is a PDF download', async () => {
    const ctx = await setup();
    await spend(ctx, { note: 'Lunch' });

    const res = await download(ctx.token, '?format=pdf');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="expenses_.*\.pdf"$/);
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(res.body.toString('latin1')).toContain('%%EOF');
    expect(pageCount(res.body)).toBe(1);
  });

  it('continues on more pages when there are many rows', async () => {
    const ctx = await setup();
    for (let i = 0; i < 40; i += 1) {
      await spend(ctx, { note: `Row ${i}` });
    }

    const res = await download(ctx.token, '?format=pdf');

    expect(res.status).toBe(200);
    expect(pageCount(res.body)).toBeGreaterThan(1);
  });

  it('does not break on Arabic text, very long notes or an empty result', async () => {
    const ctx = await setup();
    await spend(ctx, { note: 'قهوة ☕ '.repeat(50) });

    const filled = await download(ctx.token, '?format=pdf');
    const empty = await download(ctx.token, '?format=pdf&search=nothing-matches-this');

    expect(filled.status).toBe(200);
    expect(filled.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(empty.status).toBe(200);
    expect(empty.body.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('totalsByCurrency', () => {
  it('adds money exactly and keeps currencies apart', () => {
    const row = (amount, currency) => ({ amount, account: { currency } });

    expect(
      exportService.totalsByCurrency([
        row('0.10', 'USD'),
        row('0.20', 'USD'),
        row('1234567890.99', 'EUR'),
        row('0.01', 'EUR'),
      ]),
    ).toEqual([
      { currency: 'EUR', total: '1234567891.00', count: 2 },
      { currency: 'USD', total: '0.30', count: 2 },
    ]);
  });
});

describe('CORS', () => {
  it('lets the browser read the file name of a download', async () => {
    const { token } = await setup();

    const res = await api()
      .get(url('/exports/expenses'))
      .set(authHeader(token))
      .set('Origin', env.corsOrigins[0]);

    expect(res.headers['access-control-expose-headers']).toContain('Content-Disposition');
  });
});
