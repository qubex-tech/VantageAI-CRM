import { useMemo, useState } from 'react'
import { Calculator, FileText, Sparkles, Printer } from 'lucide-react'
import { CalculatorForm } from './components/CalculatorForm'
import { ResultsPanel } from './components/ResultsPanel'
import { BusinessCase } from './components/BusinessCase'
import { ProspectSearch } from './components/ProspectSearch'
import { DEFAULTS, computeRoi, type RoiInputs } from './lib/roi'
import type { ProspectResearch } from './lib/types'
import { cn } from './lib/utils'

type Tab = 'calculator' | 'business-case'

export default function App() {
  const [tab, setTab] = useState<Tab>('calculator')
  const [inputs, setInputs] = useState<RoiInputs>(DEFAULTS)
  const [research, setResearch] = useState<ProspectResearch | null>(null)

  const results = useMemo(() => computeRoi(inputs), [inputs])

  function applyResearch(r: ProspectResearch) {
    setResearch(r)
    setInputs((prev) => ({ ...prev, ...r.suggestedInputs }))
    setTab('business-case')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="no-print bg-black text-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-accent text-black font-display text-xl px-2 py-0.5">LP</div>
            <div>
              <div className="font-display text-2xl leading-none">FRONTLINE</div>
              <div className="text-xs uppercase tracking-widest text-neutral-400">
                ROI Calculator &amp; Business Case
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            <TabButton active={tab === 'calculator'} onClick={() => setTab('calculator')} icon={<Calculator size={16} />}>
              Calculator
            </TabButton>
            <TabButton active={tab === 'business-case'} onClick={() => setTab('business-case')} icon={<FileText size={16} />}>
              Business Case
            </TabButton>
            {tab === 'business-case' && (
              <button
                onClick={() => window.print()}
                className="ml-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest bg-accent text-black hover:bg-yellow-300 inline-flex items-center gap-1.5"
              >
                <Printer size={14} /> Print / PDF
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {tab === 'calculator' ? (
          <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
            <div className="space-y-6">
              <ProspectSearch onResult={applyResearch} />
              <CalculatorForm value={inputs} onChange={setInputs} />
            </div>
            <ResultsPanel inputs={inputs} results={results} />
          </div>
        ) : (
          <BusinessCase inputs={inputs} results={results} research={research} />
        )}
      </main>

      <footer className="no-print text-xs text-neutral-500 text-center py-6">
        Figures are estimates from your inputs &amp; public research. Validate before contract use.
      </footer>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 text-xs font-semibold uppercase tracking-widest inline-flex items-center gap-1.5',
        active ? 'bg-white text-black' : 'text-neutral-300 hover:text-white',
      )}
    >
      {icon}
      {children}
    </button>
  )
}
