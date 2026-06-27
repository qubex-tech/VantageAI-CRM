/**
 * SENSITIVE PII — Do Not Schedule list.
 *
 * This array contains patient identifiers (names + dates of birth) for people
 * who must not be scheduled. Treat every value here as protected health
 * information: never log it, never serialize it into responses, and never
 * commit additional copies of it elsewhere.
 *
 * Stored as structured data so we never have to re-parse a raw string at
 * request time. `dob` is canonicalized to `YYYY-MM-DD`, or `null` for entries
 * that should match on name alone.
 */

export interface DoNotScheduleEntry {
  firstName: string;
  /**
   * One or more acceptable last names. Most entries have exactly one; a few
   * people are known under multiple surnames (e.g. "Compean/Castillo").
   */
  lastNames: string[];
  /** Canonical `YYYY-MM-DD`, or `null` when the entry matches on name only. */
  dob: string | null;
}

export const DO_NOT_SCHEDULE_LIST: readonly DoNotScheduleEntry[] = [
  { firstName: "Christina", lastNames: ["Staup"], dob: "1981-04-25" },
  { firstName: "Janice", lastNames: ["Tostado"], dob: "1942-10-21" },
  { firstName: "Julia", lastNames: ["Brantham"], dob: "1988-01-24" },
  { firstName: "Rose", lastNames: ["White"], dob: "1939-04-22" }, // Rose Marie White
  { firstName: "Darrell", lastNames: ["Barnes"], dob: "1961-11-20" },
  { firstName: "Chelsea", lastNames: ["Washington"], dob: "1992-11-26" },
  { firstName: "Abdul", lastNames: ["Jalilmia"], dob: "1979-06-10" },
  { firstName: "Amna", lastNames: ["Asrar"], dob: "1999-06-30" },
  { firstName: "Miriam", lastNames: ["Bejin"], dob: "1972-08-07" },
  { firstName: "Donna", lastNames: ["Woodbury"], dob: "1951-01-14" },
  { firstName: "Earl", lastNames: ["Knight"], dob: "1978-10-01" }, // Earl R. Knight
  { firstName: "Debra", lastNames: ["Price"], dob: "1961-05-02" },
  { firstName: "Demetris", lastNames: ["Dubose"], dob: "1981-03-26" },
  { firstName: "Thomas", lastNames: ["Miller"], dob: "1943-07-09" },
  { firstName: "Cecily", lastNames: ["Gonzalez"], dob: "1987-08-23" },
  { firstName: "Theresa", lastNames: ["Compean", "Castillo"], dob: "1991-09-01" },
  { firstName: "Kelaine", lastNames: ["Carabello"], dob: "1985-05-17" },
  { firstName: "Cynthia", lastNames: ["Hawk"], dob: "1961-06-20" },
  { firstName: "Nancy", lastNames: ["Roman"], dob: "1976-12-17" },
  { firstName: "Rachel", lastNames: ["Morrison"], dob: "1995-12-05" },
  { firstName: "John", lastNames: ["Black"], dob: "1975-10-27" },
  { firstName: "Tina", lastNames: ["Frank"], dob: "1972-04-02" },
  { firstName: "Jocelyn", lastNames: ["Nichols"], dob: null }, // no DOB → name-only match
  { firstName: "Jacquelyn", lastNames: ["Hensler"], dob: "1973-12-30" },
  { firstName: "Kathryn", lastNames: ["Brown"], dob: "1995-07-27" },
  { firstName: "Cynthia", lastNames: ["Mendoza"], dob: "1965-12-22" }, // Cynthia D Mendoza
  { firstName: "Bailey", lastNames: ["Huth"], dob: "2001-08-19" },
  { firstName: "Lauren", lastNames: ["Erickson"], dob: "1990-10-12" },
  { firstName: "Hamida", lastNames: ["Ukani"], dob: "1966-03-31" },
  { firstName: "Cora", lastNames: ["Wakeland"], dob: "1967-08-19" },
  { firstName: "Nancy", lastNames: ["Mallini"], dob: "1947-03-01" },
  { firstName: "Hope", lastNames: ["Edge"], dob: "1972-06-23" },
  { firstName: "Thomas", lastNames: ["Howard"], dob: "1961-11-02" },
  { firstName: "Tina", lastNames: ["Chuter"], dob: "1964-10-11" },
  { firstName: "Stephanie", lastNames: ["Winkelman"], dob: "1977-11-12" },
  { firstName: "Ashley", lastNames: ["Ladoucieur"], dob: "2003-05-29" },
  { firstName: "Katlyn", lastNames: ["Finnegan"], dob: "2001-07-25" },
  { firstName: "Linda", lastNames: ["Smart"], dob: null }, // no DOB → name-only match
  { firstName: "Debora", lastNames: ["Ruiz"], dob: "1962-12-18" },
];
