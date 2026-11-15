'use strict';

// The words in the exported files, in English and in Arabic. The default categories are stored
// in English in the database (every user shares them), so their Arabic names live here.

const ARABIC_CATEGORIES = Object.freeze({
  Food: 'الطعام',
  Transport: 'المواصلات',
  Rent: 'الإيجار',
  Bills: 'الفواتير',
  Shopping: 'التسوق',
  Health: 'الصحة',
  Entertainment: 'الترفيه',
  Education: 'التعليم',
  Travel: 'السفر',
  Gifts: 'الهدايا',
  Other: 'أخرى',
  Salary: 'الراتب',
  Freelance: 'العمل الحر',
  Investments: 'الاستثمارات',
});

const ARABIC_PAYMENT_METHODS = Object.freeze({
  cash: 'نقدًا',
  card: 'بطاقة',
  bank_transfer: 'تحويل بنكي',
  mobile_wallet: 'محفظة إلكترونية',
  other: 'أخرى',
});

const LABELS = Object.freeze({
  en: {
    title: 'Expenses',
    sheet: 'Expenses',
    date: 'Date',
    amount: 'Amount',
    currency: 'Currency',
    category: 'Category',
    account: 'Account',
    payment: 'Payment method',
    paymentShort: 'Payment',
    tags: 'Tags',
    note: 'Note',
    total: (count) => `Total (${count} expenses)`,
    empty: 'No expenses match these filters.',
    allDates: 'All dates',
    period: (from, to) => `${from ?? 'the beginning'} to ${to ?? 'today'}`,
    summary: (period, count, generated) =>
      `${period}  |  ${count} expenses  |  Generated ${generated}`,
    page: (number, pages) => `Page ${number} of ${pages}`,
  },
  ar: {
    title: 'المصروفات',
    sheet: 'المصروفات',
    date: 'التاريخ',
    amount: 'المبلغ',
    currency: 'العملة',
    category: 'الفئة',
    account: 'الحساب',
    payment: 'طريقة الدفع',
    paymentShort: 'الدفع',
    tags: 'الوسوم',
    note: 'ملاحظة',
    total: (count) => `الإجمالي – عدد المصروفات ${count}`,
    empty: 'لا توجد مصروفات تطابق هذه الفلاتر.',
    allDates: 'كل التواريخ',
    period: (from, to) => `من ${from ?? 'البداية'} إلى ${to ?? 'اليوم'}`,
    summary: (period, count, generated) =>
      `${period}  |  عدد المصروفات ${count}  |  تاريخ الإنشاء ${generated}`,
    page: (number, pages) => `الصفحة ${number} من ${pages}`,
  },
});

/** The words of one language ("en" when the language is not known). */
const labelsFor = (lang) => LABELS[lang] ?? LABELS.en;

/** The default categories are translated, a category the person made keeps its own name. */
const categoryLabel = (lang, name) =>
  lang === 'ar' && Object.hasOwn(ARABIC_CATEGORIES, name) ? ARABIC_CATEGORIES[name] : name;

/** "bank_transfer" -> "Bank transfer" (or the Arabic words) */
function paymentLabel(lang, method) {
  if (lang === 'ar' && Object.hasOwn(ARABIC_PAYMENT_METHODS, method)) {
    return ARABIC_PAYMENT_METHODS[method];
  }
  const text = String(method).replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The date range of an export as text. */
const periodText = (lang, query) => {
  const L = labelsFor(lang);
  return query.from || query.to ? L.period(query.from, query.to) : L.allDates;
};

module.exports = { labelsFor, categoryLabel, paymentLabel, periodText };
