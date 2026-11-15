'use strict';

const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const ApiError = require('../utils/ApiError');
const { today } = require('../utils/dateHelpers');
const expenseRepository = require('../repositories/expense.repository');
const { labelsFor, categoryLabel, paymentLabel, periodText } = require('../utils/exportLabels');
const { visualRuns } = require('../utils/pdfBidi');

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

function buildFilename(query, extension) {
  const range =
    query.from || query.to ? `${query.from ?? 'start'}_to_${query.to ?? 'now'}` : today();
  return `expenses_${range}.${extension}`;
}

// ---------- CSV ----------

const UTF8_BOM = String.fromCharCode(0xfeff);

/**
 * One CSV cell. A text that starts with = + - @ (or a tab / carriage return) would be run as a
 * formula by Excel and Google Sheets, so it gets a leading ' (the OWASP advice for CSV injection).
 */
function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildCsv(expenses, lang) {
  const L = labelsFor(lang);
  const headers = [L.date, L.amount, L.currency, L.category, L.account, L.payment, L.tags, L.note];
  const lines = [headers.map(csvCell).join(',')];
  for (const e of expenses) {
    lines.push(
      [
        e.date,
        e.amount,
        e.account.currency,
        categoryLabel(lang, e.category.name),
        e.account.name,
        paymentLabel(lang, e.paymentMethod),
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

async function buildXlsx(expenses, totals, lang) {
  const L = labelsFor(lang);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = APP_NAME;
  workbook.created = new Date();

  // In Arabic the sheet is read from right to left: the first column is on the right.
  const sheet = workbook.addWorksheet(L.sheet, {
    views: [{ state: 'frozen', ySplit: 1, rightToLeft: lang === 'ar' }],
  });
  sheet.columns = [
    { header: L.date, key: 'date', width: 12, style: { numFmt: 'yyyy-mm-dd' } },
    { header: L.amount, key: 'amount', width: 14, style: { numFmt: '#,##0.00' } },
    { header: L.currency, key: 'currency', width: 10 },
    { header: L.category, key: 'category', width: 22 },
    { header: L.account, key: 'account', width: 22 },
    { header: L.payment, key: 'payment', width: 16 },
    { header: L.tags, key: 'tags', width: 24 },
    { header: L.note, key: 'note', width: 50 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };

  for (const e of expenses) {
    sheet.addRow({
      date: new Date(`${e.date}T00:00:00.000Z`),
      amount: Number(e.amount),
      currency: e.account.currency,
      category: categoryLabel(lang, e.category.name),
      account: e.account.name,
      payment: paymentLabel(lang, e.paymentMethod),
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
        category: L.total(count),
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
  // label: the word of the column title. ltr: numbers and dates keep their left-to-right order.
  columns: [
    { key: 'date', label: 'date', width: 64, ltr: true },
    { key: 'category', label: 'category', width: 120 },
    { key: 'account', label: 'account', width: 110 },
    { key: 'payment', label: 'paymentShort', width: 82 },
    { key: 'amount', label: 'amount', width: 92, align: 'right', ltr: true },
    { key: 'note', label: 'note', width: 266 },
  ],
};

// The Arabic PDF uses Noto Sans Arabic (Arabic and Latin letters, from the npm package).
const ARABIC_FONT = 'NotoSansArabic';
const ARABIC_FONT_BOLD = 'NotoSansArabic-Bold';
const arabicFontFile = (file) => require.resolve(`@expo-google-fonts/noto-sans-arabic/${file}`);

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

// The Arabic font also has the Arabic letters, so only emoji and other scripts become "?".
const NOT_ARABIC_FONT = new RegExp(
  '[^\\x20-\\x7E\\u00A0-\\u00FF\\u0600-\\u06FF\\u0750-\\u077F\\u2010-\\u2027\\u200E\\u200F]',
  'g',
);
const arabicPdfText = (value) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(NOT_ARABIC_FONT, '?')
    .trim();

/**
 * One line of right-to-left text: cut with "…" when it is wider than the box, then drawn run by
 * run in reading order (see visualRuns). align: "right" (default) or "left". `cache` remembers
 * the layout of texts that come back often (category and account names): measuring is the slow part.
 */
function drawRtlText(doc, text, x, y, width, align = 'right', cache = new Map()) {
  // "rtla" makes the font lay the Arabic letters out right to left, with the spaces between words.
  const layout = (value) => {
    let found = cache.get(value);
    if (!found) {
      const runs = visualRuns(value).map((run) => ({
        text: run.text,
        options: run.level % 2 === 1 ? { features: ['rtla'] } : {},
      }));
      for (const run of runs) run.width = doc.widthOfString(run.text, run.options);
      found = { runs, width: runs.reduce((sum, run) => sum + run.width, 0) };
      cache.set(value, found);
    }
    return found;
  };

  let line = text;
  let drawn = layout(line);
  if (drawn.width > width) {
    // The longest start of the text that fits together with "…" (a guess from the width, then a search).
    let low = 0;
    let high = Math.min(line.length, Math.ceil((line.length * width) / drawn.width) + 2);
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (layout(`${line.slice(0, middle).trimEnd()}…`).width <= width) low = middle;
      else high = middle - 1;
    }
    line = `${line.slice(0, low).trimEnd()}…`;
    drawn = layout(line);
  }

  let cursor = align === 'left' ? x : x + width - drawn.width;
  for (const run of drawn.runs) {
    doc.text(run.text, cursor, y, { lineBreak: false, ...run.options });
    cursor += run.width;
  }
}

function buildPdf(expenses, totals, query, lang) {
  return new Promise((resolve, reject) => {
    const L = labelsFor(lang);
    const rtl = lang === 'ar';
    const regular = rtl ? ARABIC_FONT : 'Helvetica';
    const bold = rtl ? ARABIC_FONT_BOLD : 'Helvetica-Bold';
    // In Arabic the table is read from right to left: the first column is on the right.
    const columns = rtl ? [...PDF.columns].reverse() : PDF.columns;

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: PDF.margin,
      bufferPages: true,
      info: { Title: L.title, Author: APP_NAME },
    });
    if (rtl) {
      doc.registerFont(ARABIC_FONT, arabicFontFile('400Regular/NotoSansArabic_400Regular.ttf'));
      doc.registerFont(ARABIC_FONT_BOLD, arabicFontFile('700Bold/NotoSansArabic_700Bold.ttf'));
    }
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // The measured layout of each text, kept apart for every font and size.
    const layouts = new Map();
    const layoutCache = (font, size) => {
      const key = `${font}|${size}`;
      if (!layouts.has(key)) layouts.set(key, new Map());
      return layouts.get(key);
    };

    const left = PDF.margin;
    const tableWidth = columns.reduce((sum, c) => sum + c.width, 0);
    const bottomLimit = () => doc.page.height - PDF.margin - PDF.footerSpace;

    // A text outside the table: title, summary line, empty message, page numbers.
    const put = (value, { font, size, color, x, y, width = tableWidth, align = 'left' }) => {
      doc.font(font).fontSize(size).fillColor(color);
      if (rtl) {
        const side = align === 'left' ? 'right' : 'left';
        drawRtlText(doc, arabicPdfText(value), x, y, width, side, layoutCache(font, size));
      } else {
        doc.text(value, x, y, align === 'left' ? undefined : { width, align, lineBreak: false });
      }
    };

    const drawRow = (y, cells, { isBold = false, fill = null } = {}) => {
      if (fill) doc.rect(left, y - 3, tableWidth, PDF.rowHeight).fill(fill);
      doc
        .fillColor('#111827')
        .font(isBold ? bold : regular)
        .fontSize(9);
      let x = left;
      for (const column of columns) {
        const boxX = x + 3;
        const boxWidth = column.width - 6;
        if (rtl && !column.ltr) {
          const cache = layoutCache(isBold, 9);
          drawRtlText(doc, arabicPdfText(cells[column.key]), boxX, y, boxWidth, 'right', cache);
        } else {
          doc.text(rtl ? arabicPdfText(cells[column.key]) : pdfText(cells[column.key]), boxX, y, {
            width: boxWidth,
            height: PDF.rowHeight - 6,
            align: rtl ? 'right' : column.align || 'left',
            lineBreak: false,
            ellipsis: true,
          });
        }
        x += column.width;
      }
    };
    const headerCells = Object.fromEntries(PDF.columns.map((c) => [c.key, L[c.label]]));

    put(L.title, { font: bold, size: 18, color: '#111827', x: left, y: left });
    put(L.summary(periodText(lang, query), expenses.length, today()), {
      font: regular,
      size: 10,
      color: '#6b7280',
      x: left,
      y: left + 26,
    });

    let y = left + 52;
    drawRow(y, headerCells, { isBold: true, fill: '#e0e7ff' });
    y += PDF.rowHeight;

    if (expenses.length === 0) {
      put(L.empty, { font: regular, size: 10, color: '#6b7280', x: left + 3, y: y + 4 });
      y += PDF.rowHeight * 2;
    }

    expenses.forEach((e, index) => {
      if (y + PDF.rowHeight > bottomLimit()) {
        doc.addPage();
        y = PDF.margin;
        drawRow(y, headerCells, { isBold: true, fill: '#e0e7ff' });
        y += PDF.rowHeight;
      }
      drawRow(
        y,
        {
          date: e.date,
          category: categoryLabel(lang, e.category.name),
          account: e.account.name,
          payment: paymentLabel(lang, e.paymentMethod),
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
        drawRow(y, { category: L.total(count), amount: `${total} ${currency}` }, { isBold: true });
        y += PDF.rowHeight;
      }
    }

    // Page numbers (written in the bottom margin, so that space is opened up for a moment).
    const { count: pages } = doc.bufferedPageRange();
    for (let i = 0; i < pages; i += 1) {
      doc.switchToPage(i);
      const savedBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      put(L.page(i + 1, pages), {
        font: regular,
        size: 8,
        color: '#6b7280',
        x: left,
        y: doc.page.height - PDF.margin,
        align: 'right',
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
  const { format, lang, sortBy, sortOrder, ...filters } = query;
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
  if (format === 'csv') buffer = buildCsv(expenses, lang);
  else if (format === 'xlsx') buffer = await buildXlsx(expenses, totals, lang);
  else buffer = await buildPdf(expenses, totals, query, lang);

  return {
    buffer,
    contentType: target.contentType,
    filename: buildFilename(query, target.extension),
  };
}

module.exports = { exportExpenses, totalsByCurrency, LIMITS };
