import { axiosClient } from '@/api/axiosClient';

// A file name from the Content-Disposition header: attachment; filename="expenses_2026-11-01.csv"
const FILENAME = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i;

/** The file name the server chose, or `fallback` when the header is missing. */
export function filenameFromHeader(header, fallback) {
  const match = typeof header === 'string' ? FILENAME.exec(header) : null;
  if (!match) return fallback;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * Downloads the expenses as a file through the API client (the Authorization header is sent,
 * a plain link could not do that). params: { format: 'csv' | 'xlsx' | 'pdf', from?, to? } (the
 * same filters as GET /expenses are possible). Answers { blob, filename }.
 *
 * A failed download answers a JSON error that axiosClient turns back into an object, so
 * error.response.status is 400 when the export has more than 5000 rows, 429 when too many
 * exports were asked for.
 */
export const downloadExpensesExport = ({ format, from, to }) =>
  axiosClient
    .get('/exports/expenses', {
      params: { format, from, to },
      responseType: 'blob',
      timeout: 2 * 60 * 1000, // a big PDF takes a while
    })
    .then((response) => ({
      blob: response.data,
      filename: filenameFromHeader(response.headers['content-disposition'], `expenses.${format}`),
    }));
