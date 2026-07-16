/** Splits on commas so pasting/typing "Al Wathba, Al Falah, Bani Yas" yields
 * three separate villages, not one literal string.
 *
 * Shared by the Study create form and the Need form — the same logic used to
 * be copy-pasted into each. Note this makes a village whose real name contains
 * a comma unrepresentable; that's the accepted trade-off of free-text entry,
 * and goes away if/when these inputs become a select backed by the org's
 * configured villages list.
 */
export function parseVillageInput(raw: string): string[] {
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}
