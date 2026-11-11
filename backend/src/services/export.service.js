'use strict';

const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const ApiError = require('../utils/ApiError');
const { today } = require('../utils/dateHelpers');
const expenseRepository = require('../repositories/expense.repository');

// One export holds at most this many rows (everything is built in memory). It is an object so
// a test can lower it.
const LIMITS = { maxRows: 5000 };

const APP_NAME = 'Expense Tracker';

// ---------- small helpers ----------

/** Exact money math: amounts are strings like "12.50", so add them as whole cents. */
const toCents = (amount) => {
  const [whole, fraction = ''] = String(amount).split('.');
  return BigInt(whole) * 100n + BigInt(`${fraction}00`.slice(0, 2));
};
const fromCents = (cents) => {
  const digits = cents.toString().padStart(3, '0');
  return `${digits.slice(0, -2)}.${digits.slice(-2)}`;
};

/** Totals per currency (amounts are never converted): [{ currency, total: "12.50", count }]. */
function totalsByCurrency(expenses) {
  const sums = new Map();
  for (const expense of expenses) {
    const { currency } = expense.account;
    const entry = sums.get(currency) || { cents: 0n, count: 0 };
    entry.cents += toCents(expense.amount);
    entry.count += 1;
    sums.set(currency, entry);
  }
  return [...sums.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, { cents, count }]) => ({ currency, total: fromCents(cents), count }));
}

/** "bank_transfer" -> "Bank transfer" */
const paymentLabel = (method) => {
  const text = String(method).replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

function buildFilename(query, extension) {
  const range =
    query.from || query.to ? `${query.from ?? 'start'}_to_${query.to ?? 'now'}` : today();
  return `expenses_${range}.${extension}`;
}

const periodText = (query) =>
  query.from || query.to
    ? `${query.from ?? 'the beginning'} to ${query.to ?? 'today'}`
    : 'All dates';

// ---------- CSV ----------

const UTF8_BOM = String.fromCharCode(0xfeff);

const CSV_HEADERS = [
  'Date',
  'Amount',
  'Currency',
  'Category',
  'Account',
  'Payment method',
  'Tags',
  'Note',
];

/**
 * One CSV cell. A text that starts with = + - @ (or a tab / carriage return) would be run as a
 * formula by Excel and Google Sheets, so it gets a leading ' (the OWASP advice for CSV injection).
 */
function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildCsv(expenses) {
  const lines = [CSV_HEADERS.map(csvCell).join(',')];
  for (const e of expenses) {
    lines.push(
      [
        e.date,
        e.amount,
        e.account.currency,
        e.category.name,
        e.account.name,
        paymentLabel(e.paymentMethod),
        e.tags.join(', '),
        e.note,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  // The BOM makes Excel read the file as UTF-8 (Arabic and other letters stay correct).
  return Buffer.from(`${UTF8_BOM}${lines.join('\r\n')}\r\n`, 'utf8');
}

// ---------- Excel ----------

async function buildXlsx(expenses, totals) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = APP_NAME;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Expenses', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: 'Date', key: 'date', width: 12, style: { numFmt: 'yyyy-mm-dd' } },
    { header: 'Amount', key: 'amount', width: 14, style: { numFmt: '#,##0.00' } },
    { header: 'Currency', key: 'currency', width: 10 },
    { header: 'Category', key: 'category', width: 22 },
    { header: 'Account', key: 'account', width: 22 },
    { header: 'Payment method', key: 'payment', width: 16 },
    { header: 'Tags', key: 'tags', width: 24 },
    { header: 'Note', key: 'note', width: 50 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };

  for (const e of expenses) {
    sheet.addRow({
      date: new Date(`${e.date}T00:00:00.000Z`),
      amount: Number(e.amount),
      currency: e.account.currency,
      category: e.category.name,
      account: e.account.name,
      payment: paymentLabel(e.paymentMethod),
      tags: e.tags.join(', '),
      note: e.note ?? '',
    });
  }
  if (expenses.length > 0) {
    sheet.autoFilter = { from: 'A1', to: `H${expenses.length + 1}` };
  }

  // One total per currency under the data, with a blank line in between.
  if (totals.length > 0) {
    sheet.addRow({});
    for (const { currency, total, count } of totals) {
      const row = sheet.addRow({
        category: `Total (${count} expenses)`,
        amount: Number(total),
        currency,
      });
      row.font = { bold: true };
    }
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// ---------- PDF ----------

const PDF = {
  margin: 36,
  rowHeight: 18,
  footerSpace: 24,
  columns: [
    { key: 'date', title: 'Date', width: 64 },
    { key: 'category', title: 'Category', width: 120 },
    { key: 'account', title: 'Account', width: 110 },
    { key: 'payment', title: 'Payment', width: 82 },
    { key: 'amount', title: 'Amount', width: 92, align: 'right' },
    { key: 'note', title: 'Note', width: 266 },
  ],
};

/**
 * The built-in PDF fonts only know Latin-1 letters. Anything else (Arabic, emoji ...) is shown
 * as "?" instead of breaking the file. CSV and Excel keep every character.
 */
// Everything except printable ASCII and the Latin-1 letters (written with escapes on purpose).
const NOT_LATIN1 = new RegExp('[^\\x20-\\x7E\\u00A0-\\u00FF]', 'g');
const pdfText = (value) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(NOT_LATIN1, '?')
    .trim();

function buildPdf(expenses, totals, query) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: PDF.margin,
      bufferPages: true,
      info: { Title: 'Expenses', Author: APP_NAME },
    });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = PDF.margin;
    const tableWidth = PDF.columns.reduce((sum, c) => sum + c.width, 0);
    const bottomLimit = () => doc.page.height - PDF.margin - PDF.footerSpace;

    const drawRow = (y, cells, { bold = false, fill = null } = {}) => {
      if (fill) doc.rect(left, y - 3, tableWidth, PDF.rowHeight).fill(fill);
      doc
        .fillColor('#111827')
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(9);
      let x = left;
      for (const column of PDF.columns) {
        doc.text(pdfText(cells[column.key]), x + 3, y, {
          width: column.width - 6,
          height: PDF.rowHeight - 6,
          align: column.align || 'left',
          lineBreak: false,
          ellipsis: true,
        });
        x += column.width;
      }
    };
    const headerCells = Object.fromEntries(PDF.columns.map((c) => [c.key, c.title]));

    doc.font('Helvetica-Bold').fontSize(18).fillColor('#111827').text('Expenses', left, left);
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#6b7280')
      .text(
        `${periodText(query)}  |  ${expenses.length} expenses  |  Generated ${today()}`,
        left,
        left + 26,
      );

    let y = left + 52;
    drawRow(y, headerCells, { bold: true, fill: '#e0e7ff' });
    y += PDF.rowHeight;

    if (expenses.length === 0) {
      doc.font('Helvetica').fontSize(10).fillColor('#6b7280');
      doc.text('No expenses match these filters.', left + 3, y + 4);
      y += PDF.rowHeight * 2;
    }

    expenses.forEach((e, index) => {
      if (y + PDF.rowHeight > bottomLimit()) {
        doc.addPage();
        y = PDF.margin;
        drawRow(y, headerCells, { bold: true, fill: '#e0e7ff' });
        y += PDF.rowHeight;
      }
      drawRow(
        y,
        {
          date: e.date,
          category: e.category.name,
          account: e.account.name,
          payment: paymentLabel(e.paymentMethod),
          amount: `${e.amount} ${e.account.currency}`,
          note: e.note,
        },
        { fill: index % 2 === 1 ? '#f3f4f6' : null },
      );
      y += PDF.rowHeight;
    });

    // Totals per currency, kept together at the end.
    if (totals.length > 0) {
      if (y + PDF.rowHeight * (totals.length + 1) > bottomLimit()) {
        doc.addPage();
        y = PDF.margin;
      }
      y += 6;
      for (const { currency, total, count } of totals) {
        drawRow(
          y,
          { category: `Total (${count} expenses)`, amount: `${total} ${currency}` },
          { bold: true },
        );
        y += PDF.rowHeight;
      }
    }

    // Page numbers (written in the bottom margin, so that space is opened up for a moment).
    const { count: pages } = doc.bufferedPageRange();
    for (let i = 0; i < pages; i += 1) {
      doc.switchToPage(i);
      const savedBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#6b7280')
        .text(`Page ${i + 1} of ${pages}`, left, doc.page.height - PDF.margin, {
          width: tableWidth,
          align: 'right',
          lineBreak: false,
        });
      doc.page.margins.bottom = savedBottom;
    }
    doc.end();
  });
}

// ---------- the export ----------

const FORMATS = {
  csv: { extension: 'csv', contentType: 'text/csv; charset=utf-8' },
  xlsx: {
    extension: 'xlsx',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  pdf: { extension: 'pdf', contentType: 'application/pdf' },
};

/**
 * Build the file of the user's expenses that match the filters (the same filters as
 * GET /expenses). Resolves { buffer, contentType, filename }.
 */
async function exportExpenses(userId, query) {
  const { format, sortBy, sortOrder, ...filters } = query;
  const target = FORMATS[format];
  if (!target) throw ApiError.badRequest('Choose a format: csv, xlsx or pdf');

  const { total } = await expenseRepository.summary(userId, filters);
  if (total > LIMITS.maxRows) {
    throw ApiError.badRequest(
      `This export has ${total} expenses, but one file holds at most ${LIMITS.maxRows}. ` +
        'Narrow the date range or add a filter.',
    );
  }

  const expenses = await expenseRepository.list(userId, filters, {
    sortBy,
    sortOrder,
    limit: LIMITS.maxRows,
    offset: 0,
  });
  const totals = totalsByCurrency(expenses);

  let buffer;
  if (format === 'csv') buffer = buildCsv(expenses);
  else if (format === 'xlsx') buffer = await buildXlsx(expenses, totals);
  else buffer = await buildPdf(expenses, totals, query);

  return {
    buffer,
    contentType: target.contentType,
    filename: buildFilename(query, target.extension),
  };
}

module.exports = { exportExpenses, totalsByCurrency, LIMITS };
