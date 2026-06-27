/**
 * Do Not Schedule list lookup.
 *
 * Used by the Retell custom-function endpoint (`/api/check-do-not-schedule`) to
 * decide, during a live call, whether a caller is on our Do Not Schedule list.
 *
 * SENSITIVE PII: the list below contains patient identifiers (names + dates of
 * birth). Treat every value here as protected health information — never log
 * it, never serialize it into responses, and never copy it elsewhere.
 *
 * Stored as structured data so we never re-parse a raw string at request time.
 * `dob` is canonicalized to `YYYY-MM-DD`, or `null` for entries that match on
 * name alone.
 */

export interface DoNotScheduleEntry {
  firstName: string
  /**
   * One or more acceptable last names. Most entries have exactly one; a few
   * people are known under multiple surnames (e.g. "Compean/Castillo").
   */
  lastNames: string[]
  /** Canonical `YYYY-MM-DD`, or `null` when the entry matches on name only. */
  dob: string | null
}

const DO_NOT_SCHEDULE_LIST: readonly DoNotScheduleEntry[] = [
  { firstName: 'Christina', lastNames: ['Staup'], dob: '1981-04-25' },
  { firstName: 'Janice', lastNames: ['Tostado'], dob: '1942-10-21' },
  { firstName: 'Julia', lastNames: ['Brantham'], dob: '1988-01-24' },
  { firstName: 'Rose', lastNames: ['White'], dob: '1939-04-22' }, // Rose Marie White
  { firstName: 'Darrell', lastNames: ['Barnes'], dob: '1961-11-20' },
  { firstName: 'Chelsea', lastNames: ['Washington'], dob: '1992-11-26' },
  { firstName: 'Abdul', lastNames: ['Jalilmia'], dob: '1979-06-10' },
  { firstName: 'Amna', lastNames: ['Asrar'], dob: '1999-06-30' },
  { firstName: 'Miriam', lastNames: ['Bejin'], dob: '1972-08-07' },
  { firstName: 'Donna', lastNames: ['Woodbury'], dob: '1951-01-14' },
  { firstName: 'Earl', lastNames: ['Knight'], dob: '1978-10-01' }, // Earl R. Knight
  { firstName: 'Debra', lastNames: ['Price'], dob: '1961-05-02' },
  { firstName: 'Demetris', lastNames: ['Dubose'], dob: '1981-03-26' },
  { firstName: 'Thomas', lastNames: ['Miller'], dob: '1943-07-09' },
  { firstName: 'Cecily', lastNames: ['Gonzalez'], dob: '1987-08-23' },
  { firstName: 'Theresa', lastNames: ['Compean', 'Castillo'], dob: '1991-09-01' },
  { firstName: 'Kelaine', lastNames: ['Carabello'], dob: '1985-05-17' },
  { firstName: 'Cynthia', lastNames: ['Hawk'], dob: '1961-06-20' },
  { firstName: 'Nancy', lastNames: ['Roman'], dob: '1976-12-17' },
  { firstName: 'Rachel', lastNames: ['Morrison'], dob: '1995-12-05' },
  { firstName: 'John', lastNames: ['Black'], dob: '1975-10-27' },
  { firstName: 'Tina', lastNames: ['Frank'], dob: '1972-04-02' },
  { firstName: 'Jocelyn', lastNames: ['Nichols'], dob: null }, // no DOB -> name-only match
  { firstName: 'Jacquelyn', lastNames: ['Hensler'], dob: '1973-12-30' },
  { firstName: 'Kathryn', lastNames: ['Brown'], dob: '1995-07-27' },
  { firstName: 'Cynthia', lastNames: ['Mendoza'], dob: '1965-12-22' }, // Cynthia D Mendoza
  { firstName: 'Bailey', lastNames: ['Huth'], dob: '2001-08-19' },
  { firstName: 'Lauren', lastNames: ['Erickson'], dob: '1990-10-12' },
  { firstName: 'Hamida', lastNames: ['Ukani'], dob: '1966-03-31' },
  { firstName: 'Cora', lastNames: ['Wakeland'], dob: '1967-08-19' },
  { firstName: 'Nancy', lastNames: ['Mallini'], dob: '1947-03-01' },
  { firstName: 'Hope', lastNames: ['Edge'], dob: '1972-06-23' },
  { firstName: 'Thomas', lastNames: ['Howard'], dob: '1961-11-02' },
  { firstName: 'Tina', lastNames: ['Chuter'], dob: '1964-10-11' },
  { firstName: 'Stephanie', lastNames: ['Winkelman'], dob: '1977-11-12' },
  { firstName: 'Ashley', lastNames: ['Ladoucieur'], dob: '2003-05-29' },
  { firstName: 'Katlyn', lastNames: ['Finnegan'], dob: '2001-07-25' },
  { firstName: 'Linda', lastNames: ['Smart'], dob: null }, // no DOB -> name-only match
  { firstName: 'Debora', lastNames: ['Ruiz'], dob: '1962-12-18' },
]

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
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Build a canonical date string, validating that the date actually exists. */
function buildDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null
  }
  if (year < 1900 || year > 2100) return null
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null

  // Reject impossible day/month combinations (e.g. Feb 30).
  const d = new Date(Date.UTC(year, month - 1, day))
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null
  }

  return `${year}-${pad2(month)}-${pad2(day)}`
}

/**
 * Normalize a spoken/typed date of birth to canonical `YYYY-MM-DD`.
 *
 * DOBs arrive from a live call (spoken aloud, then transcribed), so they show
 * up in many shapes: "04/25/1990", "4-25-1990", "April 25 1990",
 * "25 April 1990", "1990-04-25", etc. Returns `null` when the input can't be
 * confidently parsed into a real date.
 */
export function normalizeDob(input: unknown): string | null {
  if (typeof input !== 'string') return null

  const cleaned = input
    .toLowerCase()
    .replace(/[,.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return null

  // ISO-ish: 1990-04-25 or 1990/4/25
  const iso = cleaned.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
  if (iso) {
    return buildDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  }

  // US numeric: 04/25/1990, 4-25-1990 (month/day/year)
  const us = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (us) {
    return buildDate(Number(us[3]), Number(us[1]), Number(us[2]))
  }

  // Month-name forms: "april 25 1990" or "25 april 1990".
  const tokens = cleaned.split(' ')
  let month: number | undefined
  let day: number | undefined
  let year: number | undefined

  for (const token of tokens) {
    if (token in MONTHS) {
      month = MONTHS[token]
      continue
    }
    // Strip ordinal suffixes like "25th".
    const numeric = token.replace(/(st|nd|rd|th)$/, '')
    if (!/^\d+$/.test(numeric)) continue
    const value = Number(numeric)
    if (value > 31) {
      year = value
    } else if (day === undefined) {
      day = value
    } else if (year === undefined) {
      year = value
    }
  }

  if (month !== undefined && day !== undefined && year !== undefined) {
    return buildDate(year, month, day)
  }

  return null
}

/** Lowercase, strip punctuation, collapse whitespace into single spaces. */
function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** First whitespace-delimited token, used as the "first name" key. */
function firstToken(value: string): string {
  return normalizeName(value).split(' ')[0] ?? ''
}

/** Last whitespace-delimited token, used as the "last name" key. */
function lastToken(value: string): string {
  const parts = normalizeName(value).split(' ')
  return parts[parts.length - 1] ?? ''
}

function nameMatches(
  entry: DoNotScheduleEntry,
  callerFirst: string,
  callerLast: string
): boolean {
  const callerFirstKey = firstToken(callerFirst)
  const callerLastKey = lastToken(callerLast)
  if (!callerFirstKey || !callerLastKey) return false

  if (firstToken(entry.firstName) !== callerFirstKey) return false

  return entry.lastNames.some((last) => lastToken(last) === callerLastKey)
}

export interface CallerIdentity {
  firstName?: unknown
  lastName?: unknown
  dateOfBirth?: unknown
}

/**
 * Returns true when the caller is on the Do Not Schedule list.
 *
 * Name comparison is case-insensitive and tolerant of extra whitespace,
 * punctuation, and middle initials/names (e.g. "Earl R. Knight" matches
 * "Earl Knight"). A caller matches an entry when first+last name match AND the
 * DOB matches; entries with no DOB on file (`dob === null`) match on name alone.
 */
export function isOnDoNotScheduleList(caller: CallerIdentity): boolean {
  const firstName = typeof caller.firstName === 'string' ? caller.firstName : ''
  const lastName = typeof caller.lastName === 'string' ? caller.lastName : ''
  if (!firstName.trim() || !lastName.trim()) return false

  const callerDob = normalizeDob(caller.dateOfBirth)

  return DO_NOT_SCHEDULE_LIST.some((entry) => {
    if (!nameMatches(entry, firstName, lastName)) return false

    // Name-only entries (no DOB on file) match purely on name.
    if (entry.dob === null) return true

    // Otherwise the DOB must be present and match exactly.
    return callerDob !== null && callerDob === entry.dob
  })
}
