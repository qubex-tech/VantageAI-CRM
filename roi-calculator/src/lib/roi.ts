// ROI model for LP Frontline (workforce onboarding + allergen compliance).
//
// All monetary values are in the chosen currency unit; the caller decides the
// symbol. Defaults assume UK food-retail (Greggs benchmark in the deck):
//   - Frontline wage: £11.44/hr (UK NLW 2024)
//   - Manager wage:   £14.00/hr
//   - Onboarding:     6 hrs without LP / 3 hrs with LP (50% reduction)
//   - Manager oversight: 2 hrs without LP / 0.5 hrs with LP (75% reduction)
//   - Annual sector turnover: ~75%

export interface RoiInputs {
  // Workforce
  totalFrontlineWorkers: number
  storeCount: number
  annualTurnoverPct: number // 0..1, e.g. 0.75
  // Hours per new starter
  onboardingHoursWithout: number
  onboardingHoursWith: number
  managerHoursWithout: number
  managerHoursWith: number
  // Rates
  frontlineHourlyRate: number
  managerHourlyRate: number
  currency: '£' | '$' | '€'
  // FTE definition for converting savings into headcount equivalent
  fteHoursPerYear: number
}

export const DEFAULTS: RoiInputs = {
  totalFrontlineWorkers: 24_000,
  storeCount: 2_200,
  annualTurnoverPct: 0.75,
  onboardingHoursWithout: 6,
  onboardingHoursWith: 3,
  managerHoursWithout: 2,
  managerHoursWith: 0.5,
  frontlineHourlyRate: 11.44,
  managerHourlyRate: 14,
  currency: '£',
  fteHoursPerYear: 1_820, // 35 hrs/wk × 52
}

export interface RoiResults {
  // Volumes
  newHiresPerYear: number
  onboardingHoursWithout: number
  onboardingHoursWith: number
  // Costs WITHOUT product
  newHireCostWithout: number
  managerCostWithout: number
  totalCostWithout: number
  // Costs WITH product
  newHireCostWith: number
  managerCostWith: number
  totalCostWith: number
  // Savings
  newHireSaving: number
  managerSaving: number
  totalSaving: number
  // Conversions
  yearsOfWorkingTime: number // onboarding hours expressed in human-years
  fteEquivalent: number      // savings hours expressed in FTEs
  onboardingReductionPct: number
  managerReductionPct: number
}

export function computeRoi(i: RoiInputs): RoiResults {
  const newHiresPerYear = Math.round(i.totalFrontlineWorkers * i.annualTurnoverPct)

  const onboardingHoursWithout = newHiresPerYear * i.onboardingHoursWithout
  const onboardingHoursWith = newHiresPerYear * i.onboardingHoursWith

  const newHireCostWithout = onboardingHoursWithout * i.frontlineHourlyRate
  const newHireCostWith = onboardingHoursWith * i.frontlineHourlyRate

  const managerHoursWithout = newHiresPerYear * i.managerHoursWithout
  const managerHoursWith = newHiresPerYear * i.managerHoursWith
  const managerCostWithout = managerHoursWithout * i.managerHourlyRate
  const managerCostWith = managerHoursWith * i.managerHourlyRate

  const totalCostWithout = newHireCostWithout + managerCostWithout
  const totalCostWith = newHireCostWith + managerCostWith

  const newHireSaving = newHireCostWithout - newHireCostWith
  const managerSaving = managerCostWithout - managerCostWith
  const totalSaving = newHireSaving + managerSaving

  // Total onboarding hours consumed without LP, expressed in human-years
  // (1 FTE-year using the configured fteHoursPerYear basis).
  const yearsOfWorkingTime = onboardingHoursWithout / i.fteHoursPerYear

  // Hours saved per year converted into FTEs
  const hoursSaved =
    (i.onboardingHoursWithout - i.onboardingHoursWith) * newHiresPerYear +
    (i.managerHoursWithout - i.managerHoursWith) * newHiresPerYear
  const fteEquivalent = hoursSaved / i.fteHoursPerYear

  const onboardingReductionPct =
    i.onboardingHoursWithout > 0
      ? 1 - i.onboardingHoursWith / i.onboardingHoursWithout
      : 0
  const managerReductionPct =
    i.managerHoursWithout > 0
      ? 1 - i.managerHoursWith / i.managerHoursWithout
      : 0

  return {
    newHiresPerYear,
    onboardingHoursWithout,
    onboardingHoursWith,
    newHireCostWithout,
    managerCostWithout,
    totalCostWithout,
    newHireCostWith,
    managerCostWith,
    totalCostWith,
    newHireSaving,
    managerSaving,
    totalSaving,
    yearsOfWorkingTime,
    fteEquivalent,
    onboardingReductionPct,
    managerReductionPct,
  }
}

// ---- Formatters -------------------------------------------------------------

export function fmtMoney(value: number, currency: string): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${currency}${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`
  if (abs >= 1_000) return `${currency}${Math.round(value / 1_000).toLocaleString()}K`
  return `${currency}${Math.round(value).toLocaleString()}`
}

export function fmtNumber(value: number): string {
  return Math.round(value).toLocaleString()
}

export function fmtPct(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function fmtHours(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000) return `${Math.round(value / 1_000).toLocaleString()}K hrs`
  return `${Math.round(value).toLocaleString()} hrs`
}
