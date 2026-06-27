/**
 * Matching logic for the Do Not Schedule lookup.
 *
 * Name comparison is case-insensitive and tolerant of extra whitespace,
 * punctuation, and middle initials/names: we reduce a name to its first
 * meaningful token (first name) and last meaningful token (last name).
 * That makes "Earl R. Knight" match "Earl Knight" and "Cynthia D Mendoza"
 * match "Cynthia Mendoza".
 */

import { DO_NOT_SCHEDULE_LIST, type DoNotScheduleEntry } from "./do-not-schedule-list";
import { normalizeDob } from "./dob";

/** Lowercase, strip punctuation, collapse whitespace into single spaces. */
function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** First whitespace-delimited token, used as the "first name" key. */
function firstToken(value: string): string {
  const normalized = normalizeName(value);
  return normalized.split(" ")[0] ?? "";
}

/** Last whitespace-delimited token, used as the "last name" key. */
function lastToken(value: string): string {
  const normalized = normalizeName(value);
  const parts = normalized.split(" ");
  return parts[parts.length - 1] ?? "";
}

function nameMatches(
  entry: DoNotScheduleEntry,
  callerFirst: string,
  callerLast: string,
): boolean {
  const callerFirstKey = firstToken(callerFirst);
  const callerLastKey = lastToken(callerLast);
  if (!callerFirstKey || !callerLastKey) return false;

  if (firstToken(entry.firstName) !== callerFirstKey) return false;

  return entry.lastNames.some((last) => lastToken(last) === callerLastKey);
}

export interface CallerIdentity {
  firstName?: unknown;
  lastName?: unknown;
  dateOfBirth?: unknown;
}

/**
 * Returns true when the caller is on the Do Not Schedule list.
 *
 * A caller matches an entry when first+last name match AND the DOB matches.
 * Entries with no DOB on file (`dob === null`) match on name alone.
 */
export function isOnDoNotScheduleList(caller: CallerIdentity): boolean {
  const firstName = typeof caller.firstName === "string" ? caller.firstName : "";
  const lastName = typeof caller.lastName === "string" ? caller.lastName : "";
  if (!firstName.trim() || !lastName.trim()) return false;

  const callerDob = normalizeDob(caller.dateOfBirth);

  return DO_NOT_SCHEDULE_LIST.some((entry) => {
    if (!nameMatches(entry, firstName, lastName)) return false;

    // Name-only entries (no DOB on file) match purely on name.
    if (entry.dob === null) return true;

    // Otherwise the DOB must be present and match exactly.
    return callerDob !== null && callerDob === entry.dob;
  });
}
