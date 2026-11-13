/**
 * Saves a Blob (a file the API sent) to the user's computer, with the given file name.
 * It clicks an invisible link, then releases the temporary address a moment later.
 */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // The browser needs a moment to start the download before the address is released.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
