/**
 * Date-of-birth normalization.
 *
 * DOBs arrive from a live phone call (spoken aloud, then transcribed), so they
 * show up in many shapes: "04/25/1990", "4-25-1990", "April 25 1990",
 * "25 April 1990", "1990-04-25", etc. We collapse all of these to a canonical
 * `YYYY-MM-DD` string so both sides of a comparison are apples-to-apples.
 *
 * Returns `null` when the input can't be confidently parsed into a real date.
 */

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Build a canonical date string, validating that the date actually exists. */
function build(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  // Reject impossible day/month combinations (e.g. Feb 30).
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function normalizeDob(input: unknown): string | null {
  if (typeof input !== "string") return null;

  // Lowercase, strip commas/periods, collapse whitespace.
  const cleaned = input
    .toLowerCase()
    .replace(/[,.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return null;

  // ISO-ish: 1990-04-25 or 1990/4/25
  const iso = cleaned.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (iso) {
    return build(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  // US numeric: 04/25/1990, 4-25-1990, 4.25.1990 (month/day/year)
  const us = cleaned.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (us) {
    return build(Number(us[3]), Number(us[1]), Number(us[2]));
  }

  // Month-name forms: "april 25 1990" or "25 april 1990".
  const tokens = cleaned.split(" ");
  let month: number | undefined;
  let day: number | undefined;
  let year: number | undefined;

  for (const token of tokens) {
    if (token in MONTHS) {
      month = MONTHS[token];
      continue;
    }
    // Strip ordinal suffixes like "25th".
    const numeric = token.replace(/(st|nd|rd|th)$/, "");
    if (!/^\d+$/.test(numeric)) continue;
    const value = Number(numeric);
    if (value > 31) {
      year = value;
    } else if (day === undefined) {
      day = value;
    } else if (year === undefined) {
      year = value;
    }
  }

  if (month !== undefined && day !== undefined && year !== undefined) {
    return build(year, month, day);
  }

  return null;
}
