import type { RoiInputs } from '../lib/roi'

interface Props {
  value: RoiInputs
  onChange: (next: RoiInputs) => void
}

export function CalculatorForm({ value, onChange }: Props) {
  function set<K extends keyof RoiInputs>(key: K, v: RoiInputs[K]) {
    onChange({ ...value, [key]: v })
  }

  return (
    <div className="bg-white border border-neutral-200 shadow-sm">
      <div className="px-5 py-4 border-b border-neutral-200">
        <h2 className="font-display text-2xl">Inputs</h2>
        <p className="text-xs text-neutral-500 mt-1">
          Adjust the numbers — results update live on the right.
        </p>
      </div>
      <div className="p-5 space-y-5">
        <Section title="Workforce">
          <Field label="Total frontline workers">
            <NumInput value={value.totalFrontlineWorkers} onChange={(v) => set('totalFrontlineWorkers', v)} step={100} />
          </Field>
          <Field label="Stores / sites">
            <NumInput value={value.storeCount} onChange={(v) => set('storeCount', v)} step={10} />
          </Field>
          <Field label="Annual turnover %">
            <NumInput
              value={Math.round(value.annualTurnoverPct * 100)}
              onChange={(v) => set('annualTurnoverPct', v / 100)}
              suffix="%"
              max={200}
            />
          </Field>
        </Section>

        <Section title="Hours per new starter">
          <Field label="Onboarding (without LP)">
            <NumInput value={value.onboardingHoursWithout} onChange={(v) => set('onboardingHoursWithout', v)} suffix="hrs" step={0.5} />
          </Field>
          <Field label="Onboarding (with LP)">
            <NumInput value={value.onboardingHoursWith} onChange={(v) => set('onboardingHoursWith', v)} suffix="hrs" step={0.5} />
          </Field>
          <Field label="Manager oversight (without)">
            <NumInput value={value.managerHoursWithout} onChange={(v) => set('managerHoursWithout', v)} suffix="hrs" step={0.25} />
          </Field>
          <Field label="Manager oversight (with)">
            <NumInput value={value.managerHoursWith} onChange={(v) => set('managerHoursWith', v)} suffix="hrs" step={0.25} />
          </Field>
        </Section>

        <Section title="Rates">
          <Field label="Frontline hourly rate">
            <NumInput value={value.frontlineHourlyRate} onChange={(v) => set('frontlineHourlyRate', v)} prefix={value.currency} step={0.25} />
          </Field>
          <Field label="Manager hourly rate">
            <NumInput value={value.managerHourlyRate} onChange={(v) => set('managerHourlyRate', v)} prefix={value.currency} step={0.5} />
          </Field>
          <Field label="Currency">
            <select
              value={value.currency}
              onChange={(e) => set('currency', e.target.value as RoiInputs['currency'])}
              className="w-full px-3 py-2 border border-neutral-300 text-sm bg-white"
            >
              <option value="£">£ GBP</option>
              <option value="$">$ USD</option>
              <option value="€">€ EUR</option>
            </select>
          </Field>
          <Field label="FTE hours / year">
            <NumInput value={value.fteHoursPerYear} onChange={(v) => set('fteHoursPerYear', v)} step={50} />
          </Field>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-neutral-500 mb-2">{title}</div>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-neutral-600 mb-1">{label}</span>
      {children}
    </label>
  )
}

function NumInput({
  value,
  onChange,
  prefix,
  suffix,
  step = 1,
  max,
}: {
  value: number
  onChange: (v: number) => void
  prefix?: string
  suffix?: string
  step?: number
  max?: number
}) {
  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">{prefix}</span>
      )}
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        max={max}
        min={0}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full py-2 border border-neutral-300 text-sm tabular-nums bg-white ${
          prefix ? 'pl-6' : 'pl-3'
        } ${suffix ? 'pr-10' : 'pr-3'}`}
      />
      {suffix && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 text-xs">{suffix}</span>
      )}
    </div>
  )
}
