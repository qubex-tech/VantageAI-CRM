import type { RoiInputs, RoiResults } from '../lib/roi'
import { fmtHours, fmtMoney, fmtNumber, fmtPct } from '../lib/roi'

interface Props {
  inputs: RoiInputs
  results: RoiResults
}

export function ResultsPanel({ inputs, results }: Props) {
  const c = inputs.currency
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BigStat
          value={fmtNumber(inputs.totalFrontlineWorkers)}
          label={`frontline workers across ${fmtNumber(inputs.storeCount)} stores`}
        />
        <BigStat
          value={fmtNumber(results.newHiresPerYear)}
          label="new hires every year"
          sub={`~${Math.round(inputs.annualTurnoverPct * 100)}% annual turnover`}
        />
        <BigStat
          value={fmtNumber(results.onboardingHoursWithout)}
          label="onboarding hours per year"
          sub={`= ${results.yearsOfWorkingTime.toFixed(1)} years of working time`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SoftCard tag="The Hidden Time Cost">
          {fmtNumber(results.newHiresPerYear)} hires × {inputs.onboardingHoursWithout} hrs ={' '}
          {fmtNumber(results.onboardingHoursWithout)} hrs — consumed before a single customer is served.
        </SoftCard>
        <SoftCard tag="The Manager Burden">
          {fmtNumber(results.newHiresPerYear)} × {inputs.managerHoursWithout} hrs × {c}
          {inputs.managerHourlyRate.toFixed(2)}/hr = {fmtMoney(results.managerCostWithout, c)}/yr in manager time not running stores.
        </SoftCard>
      </div>

      <div className="bg-black text-white p-5">
        <div className="text-xs uppercase tracking-widest text-neutral-400 mb-3">Comparison</div>
        <div className="grid grid-cols-3 gap-px bg-neutral-800">
          <HeaderCell>Metric</HeaderCell>
          <HeaderCell>Without LP</HeaderCell>
          <HeaderCell highlight>With LP Frontline</HeaderCell>

          <RowCell>New starter onboarding time</RowCell>
          <RowCell>{inputs.onboardingHoursWithout} hours</RowCell>
          <RowCell highlight sub={`${fmtPct(results.onboardingReductionPct)} reduction`}>
            {inputs.onboardingHoursWith} hours
          </RowCell>

          <RowCell>Manager oversight per hire</RowCell>
          <RowCell>{inputs.managerHoursWithout} hours</RowCell>
          <RowCell highlight sub={`${fmtPct(results.managerReductionPct)} reduction`}>
            {inputs.managerHoursWith * 60 < 60 ? `${inputs.managerHoursWith * 60} minutes` : `${inputs.managerHoursWith} hours`}
          </RowCell>

          <RowCell>New hire time cost / year</RowCell>
          <RowCell>{fmtMoney(results.newHireCostWithout, c)}</RowCell>
          <RowCell highlight sub={`${fmtNumber(results.newHiresPerYear)} × ${inputs.onboardingHoursWith}hrs × ${c}${inputs.frontlineHourlyRate}`}>
            {fmtMoney(results.newHireSaving, c)} saved
          </RowCell>

          <RowCell>Manager time cost / year</RowCell>
          <RowCell>{fmtMoney(results.managerCostWithout, c)}</RowCell>
          <RowCell highlight sub={`${fmtNumber(results.newHiresPerYear)} × ${inputs.managerHoursWith}hrs × ${c}${inputs.managerHourlyRate}`}>
            {fmtMoney(results.managerSaving, c)} saved
          </RowCell>
        </div>

        <div className="mt-5 bg-neutral-900 p-4 text-center">
          <div className="text-xs uppercase tracking-widest text-neutral-400">Total recoverable</div>
          <div className="font-display text-4xl mt-1">
            {fmtMoney(results.totalSaving, c)} / year
          </div>
          <div className="text-sm text-neutral-300 mt-1">
            = {results.fteEquivalent.toFixed(0)} full-time frontline workers redirected to serving customers
          </div>
        </div>
      </div>

      <div className="bg-white border border-neutral-200 p-4 text-sm text-neutral-700">
        <span className="tag mr-2">Sanity check</span>
        Total hours without LP: {fmtHours(results.onboardingHoursWithout)} · with LP:{' '}
        {fmtHours(results.onboardingHoursWith)} · reduction:{' '}
        {fmtPct(results.onboardingReductionPct)}
      </div>
    </div>
  )
}

function BigStat({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="bg-black text-white p-5">
      <div className="font-display text-5xl">{value}</div>
      <div className="text-sm mt-3">{label}</div>
      {sub && <div className="text-xs text-neutral-400 mt-2">{sub}</div>}
    </div>
  )
}

function SoftCard({ tag, children }: { tag: string; children: React.ReactNode }) {
  return (
    <div className="slab-soft p-4">
      <div className="text-[10px] uppercase tracking-widest text-neutral-400">{tag}</div>
      <div className="text-sm mt-2 leading-relaxed">{children}</div>
    </div>
  )
}

function HeaderCell({ children, highlight }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`px-3 py-2 text-[10px] uppercase tracking-widest ${highlight ? 'bg-neutral-900 text-accent' : 'bg-neutral-900 text-neutral-400'}`}>
      {children}
    </div>
  )
}

function RowCell({
  children,
  sub,
  highlight,
}: {
  children: React.ReactNode
  sub?: string
  highlight?: boolean
}) {
  return (
    <div className={`px-3 py-3 ${highlight ? 'bg-neutral-900' : 'bg-black'}`}>
      <div className={`font-display text-lg ${highlight ? 'text-white' : 'text-neutral-200'}`}>{children}</div>
      {sub && <div className="text-[11px] text-neutral-400 mt-1">{sub}</div>}
    </div>
  )
}
