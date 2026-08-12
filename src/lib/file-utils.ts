/** Returns the lowercase extension of a filename including the leading dot
 * (e.g. `.pdf`), or an empty string if the name has no dot. */
export function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx === -1 ? "" : fileName.slice(idx).toLowerCase();
}
