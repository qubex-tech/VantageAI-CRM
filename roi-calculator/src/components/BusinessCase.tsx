import type { RoiInputs, RoiResults } from '../lib/roi'
import { fmtMoney, fmtNumber } from '../lib/roi'
import type { ProspectResearch } from '../lib/types'

interface Props {
  inputs: RoiInputs
  results: RoiResults
  research: ProspectResearch | null
}

const FALLBACK_HERO =
  'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=1600&q=70'

export function BusinessCase({ inputs, results, research }: Props) {
  const c = inputs.currency
  const companyName = research?.company.name ?? 'Your Prospect'
  const sectorTurnover = Math.round((research?.workforce.annualTurnoverPct ?? inputs.annualTurnoverPct) * 100)

  const cadenceDays = research?.workforce.storeCount && research.workforce.storeCount > 0
    ? (365 / Math.max(1, Math.round(research.workforce.storeCount / 5))).toFixed(1)
    : '2.4'

  const headline =
    research?.narrative.headline ?? `Before a Single ${guessProduct(research)} Is Sold.`
  const subhead =
    research?.narrative.subhead ??
    `Every ${cadenceDays} days, ${companyName} opens a new site. Every day, dozens of new people need compliance training before their first shift.`

  return (
    <div className="bg-neutral-100">
      {/* PAGE 1 — Hero ROI */}
      <article className="print-page max-w-6xl mx-auto px-4 py-8">
        <div
          className="hero-bg shadow-xl magazine-card"
          style={{ backgroundImage: `url(${FALLBACK_HERO})` }}
        >
          <div className="bg-black/60 p-8 md:p-12">
            <span className="tag">{companyName.toUpperCase()} — PROSPECT STORY</span>
            <h1 className="font-display text-white text-5xl md:text-7xl leading-[0.95] mt-4 max-w-4xl">
              {headline}
            </h1>
            <div className="slab mt-6 p-4 md:p-5 max-w-4xl">
              <p className="text-sm md:text-base">{subhead}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <BigStatCard
                value={fmtNumber(inputs.totalFrontlineWorkers)}
                label={`frontline workers across ${fmtNumber(inputs.storeCount)} stores`}
                footnote={`${companyName} workforce`}
              />
              <BigStatCard
                value={fmtNumber(results.newHiresPerYear)}
                label="new hires every year"
                footnote={`~${sectorTurnover}% annual sector turnover`}
              />
              <BigStatCard
                value={fmtNumber(results.onboardingHoursWithout)}
                label="onboarding hours per year"
                footnote={`= ${results.yearsOfWorkingTime.toFixed(1)} years of working time`}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <SoftSlab tag="The Hidden Time Cost">
                {research?.narrative.hiddenTimeCost ??
                  `${fmtNumber(results.newHiresPerYear)} hires × ${inputs.onboardingHoursWithout} hrs = ${fmtNumber(
                    results.onboardingHoursWithout,
                  )} hrs — consumed before a single customer is served.`}
              </SoftSlab>
              <SoftSlab tag="The Manager Burden">
                {research?.narrative.managerBurden ??
                  `${fmtNumber(results.newHiresPerYear)} × ${inputs.managerHoursWithout} hrs × ${c}${inputs.managerHourlyRate}/hr = ${fmtMoney(
                    results.managerCostWithout,
                    c,
                  )}/year in manager time not running stores.`}
              </SoftSlab>
            </div>

            <div className="mt-6 bg-black/80 px-5 py-4 italic text-center text-white text-sm md:text-base">
              {research?.narrative.closingLine ??
                `That's the equivalent of ${results.yearsOfWorkingTime.toFixed(
                  1,
                )} years of continuous working time — gone before a single sale is made.`}
            </div>
          </div>
        </div>
      </article>

      {/* PAGE 2 — Impact table */}
      <article className="print-page max-w-6xl mx-auto px-4 py-8">
        <div
          className="hero-bg shadow-xl magazine-card"
          style={{ backgroundImage: `url(${FALLBACK_HERO})` }}
        >
          <div className="bg-black/60 p-8 md:p-12">
            <span className="tag">{companyName.toUpperCase()} — LP FRONTLINE IMPACT</span>
            <h2 className="font-display text-white text-4xl md:text-6xl leading-[0.95] mt-4 max-w-3xl">
              The {fmtMoney(results.totalSaving, c)} That's Sitting in Your Onboarding Process.
            </h2>

            <div className="mt-6 grid grid-cols-3 gap-px bg-neutral-800">
              <Header>Metric</Header>
              <Header>Without LP</Header>
              <Header>With LP Frontline</Header>

              <Cell>New starter onboarding time</Cell>
              <Cell big>{inputs.onboardingHoursWithout} hours</Cell>
              <Cell big highlight footnote={`${Math.round(results.onboardingReductionPct * 100)}% reduction — industry benchmark`}>
                {inputs.onboardingHoursWith} hours
              </Cell>

              <Cell>Manager oversight per hire</Cell>
              <Cell big>{inputs.managerHoursWithout} hours</Cell>
              <Cell big highlight footnote={`${Math.round(results.managerReductionPct * 100)}% reduction — managers back on floor`}>
                {minutesOrHours(inputs.managerHoursWith)}
              </Cell>

              <Cell>New hire time cost / year</Cell>
              <Cell big>{fmtMoney(results.newHireCostWithout, c)}</Cell>
              <Cell big highlight footnote={`${fmtNumber(results.newHiresPerYear)} × ${inputs.onboardingHoursWith}hrs × ${c}${inputs.frontlineHourlyRate}`}>
                {fmtMoney(results.newHireSaving, c)} saved
              </Cell>

              <Cell>Manager time cost / year</Cell>
              <Cell big>{fmtMoney(results.managerCostWithout, c)}</Cell>
              <Cell big highlight footnote={`${fmtNumber(results.newHiresPerYear)} × ${inputs.managerHoursWith}hrs × ${c}${inputs.managerHourlyRate}`}>
                {fmtMoney(results.managerSaving, c)} saved
              </Cell>
            </div>

            <div className="mt-6 bg-black/80 p-5 text-center text-white">
              <div className="font-display text-2xl md:text-3xl">
                Total recoverable: ~{fmtMoney(results.totalSaving, c)} / year ={' '}
                {results.fteEquivalent.toFixed(0)} full-time frontline workers redirected to
                serving customers
              </div>
            </div>

            <div className="mt-6 bg-neutral-900/90 p-5 grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4 items-start">
              <div className="text-[10px] uppercase tracking-widest text-neutral-400">Compliance Kicker</div>
              <div className="text-sm text-white">
                {research?.narrative.complianceKicker ??
                  `With ${fmtNumber(results.newHiresPerYear)} new hires annually, untrained staff isn't a risk — it's a statistical certainty without a system.`}
              </div>
            </div>
          </div>
        </div>
      </article>

      {/* PAGE 3 — Strategic outcomes + sources */}
      {(research?.narrative.strategicOutcomes?.length || research?.recentNews?.length) && (
        <article className="print-page max-w-6xl mx-auto px-4 py-8">
          <div className="bg-black text-white p-8 md:p-12 shadow-xl">
            <span className="tag">{companyName.toUpperCase()} — STRATEGIC FIT</span>
            <h2 className="font-display text-4xl md:text-5xl mt-4 max-w-3xl">
              Strategic Outcomes Across the Entire Business.
            </h2>

            {research?.narrative.strategicOutcomes && research.narrative.strategicOutcomes.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {research.narrative.strategicOutcomes.map((s, i) => (
                  <div key={i} className="bg-neutral-900 p-5">
                    <div className="font-display text-xl text-accent">{s.title}</div>
                    <p className="text-sm text-neutral-200 mt-2 leading-relaxed">{s.body}</p>
                  </div>
                ))}
              </div>
            )}

            {research?.recentNews && research.recentNews.length > 0 && (
              <div className="mt-8">
                <div className="text-xs uppercase tracking-widest text-neutral-400 mb-3">
                  Recent Signals
                </div>
                <ul className="space-y-3">
                  {research.recentNews.map((n, i) => (
                    <li key={i} className="border-l-2 border-accent pl-3">
                      <div className="font-semibold text-sm">
                        {n.title}
                        {n.date && <span className="text-neutral-500 font-normal"> · {n.date}</span>}
                      </div>
                      <div className="text-xs text-neutral-300 mt-0.5">{n.summary}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {research?.sources && research.sources.length > 0 && (
              <div className="mt-8 text-[11px] text-neutral-500">
                <div className="uppercase tracking-widest mb-2">Sources</div>
                <ul className="space-y-1">
                  {research.sources.slice(0, 8).map((s, i) => (
                    <li key={i}>
                      <a href={s.uri} target="_blank" rel="noreferrer" className="hover:underline">
                        {s.title || s.uri}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </article>
      )}

      {!research && (
        <div className="max-w-6xl mx-auto px-4 py-12 text-center text-neutral-600">
          <p className="text-sm">
            No prospect researched yet. The page above shows generic figures from your inputs.
          </p>
          <p className="text-sm mt-2">
            Head back to <strong>Calculator</strong> and search a prospect by name to generate a
            tailored business case.
          </p>
        </div>
      )}
    </div>
  )
}

function minutesOrHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} minutes`
  return `${h} hours`
}

function guessProduct(r: ProspectResearch | null): string {
  if (!r) return 'Sale'
  const ind = (r.company.industry ?? '').toLowerCase()
  if (ind.includes('coffee')) return 'Coffee'
  if (ind.includes('bakery') || ind.includes('food')) return 'Sausage Roll'
  if (ind.includes('hotel')) return 'Room'
  if (ind.includes('grocery') || ind.includes('supermarket')) return 'Basket'
  if (ind.includes('retail')) return 'Transaction'
  return 'Sale'
}

function BigStatCard({
  value,
  label,
  footnote,
}: {
  value: string
  label: string
  footnote?: string
}) {
  return (
    <div className="slab p-5">
      <div className="font-display text-5xl md:text-6xl leading-none">{value}</div>
      <div className="text-sm mt-3">{label}</div>
      {footnote && <div className="text-xs text-neutral-400 mt-2">{footnote}</div>}
    </div>
  )
}

function SoftSlab({ tag, children }: { tag: string; children: React.ReactNode }) {
  return (
    <div className="slab-soft p-4">
      <div className="text-[10px] uppercase tracking-widest text-neutral-400">{tag}</div>
      <div className="text-sm mt-2 leading-relaxed">{children}</div>
    </div>
  )
}

function Header({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-neutral-900 px-3 py-2 text-[10px] uppercase tracking-widest text-neutral-400">
      {children}
    </div>
  )
}

function Cell({
  children,
  big,
  highlight,
  footnote,
}: {
  children: React.ReactNode
  big?: boolean
  highlight?: boolean
  footnote?: string
}) {
  return (
    <div className={`px-4 py-3 ${highlight ? 'bg-neutral-900' : 'bg-black'}`}>
      <div className={big ? 'font-display text-2xl' : 'text-sm text-neutral-200'}>{children}</div>
      {footnote && <div className="text-[11px] text-neutral-400 mt-1">{footnote}</div>}
    </div>
  )
}
