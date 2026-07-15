// Builds a case-insensitive matcher from a user-typed search string that may
// contain '*' as a "match anything" wildcard. Every other regex-special
// character is escaped, so plain text with no '*' behaves exactly like a
// substring search (matching the app's original .includes() behavior),
// while '*' expands to '.*' — including on both sides (e.g. "*urgent*"),
// which needs no special-casing since it's the same single pattern.
export function buildWildcardMatcher(pattern: string): (text: string) => boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  const re = new RegExp(escaped, 'i');
  return (text: string) => re.test(text);
}
