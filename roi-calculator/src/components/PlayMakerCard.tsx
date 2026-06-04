import { useState } from 'react'
import {
  X,
  Linkedin,
  MapPin,
  Briefcase,
  Quote,
  MessageSquare,
  AlertTriangle,
  Handshake,
  ChevronDown,
  ChevronUp,
  ShieldQuestion,
} from 'lucide-react'
import type { PlayMaker } from '../lib/types'

interface Props {
  playMaker: PlayMaker
  onRemove: () => void
}

export function PlayMakerCard({ playMaker: p, onRemove }: Props) {
  const [expanded, setExpanded] = useState(false)
  const failed = !p.fullName && p.identityNotes?.startsWith('Research failed')

  return (
    <article className="bg-white border border-neutral-200 shadow-sm relative">
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-2 right-2 p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50"
        title="Wrong person? Remove this card"
        aria-label="Remove play maker"
      >
        <X size={16} />
      </button>

      <header className="p-5 border-b border-neutral-200">
        <div className="text-[10px] uppercase tracking-widest text-neutral-500">
          Searched: <span className="text-neutral-700">{p.inputName}</span>
        </div>
        <h3 className="font-display text-2xl mt-1">{p.fullName ?? p.inputName}</h3>
        {p.title && (
          <div className="text-sm text-neutral-700 mt-0.5">
            {p.title}
            {p.company && <span className="text-neutral-500"> · {p.company}</span>}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-neutral-500">
          {p.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} /> {p.location}
            </span>
          )}
          {p.tenure && (
            <span className="inline-flex items-center gap-1">
              <Briefcase size={12} /> {p.tenure}
            </span>
          )}
          {p.linkedinUrl && (
            <a
              href={p.linkedinUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-blue-700 hover:underline"
            >
              <Linkedin size={12} /> LinkedIn
            </a>
          )}
          <ConfidenceBadge level={p.confidence} />
        </div>
      </header>

      {failed ? (
        <div className="p-5 text-sm text-red-700 bg-red-50 inline-flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">Research failed for this person</div>
            <div className="text-xs text-red-800 mt-0.5">{p.identityNotes}</div>
          </div>
        </div>
      ) : (
        <div className="p-5 space-y-4">
          {p.bio && <p className="text-sm text-neutral-800 leading-relaxed">{p.bio}</p>}

          {p.identityNotes && p.confidence !== 'high' && (
            <div className="text-xs bg-amber-50 border border-amber-200 p-3 inline-flex items-start gap-2">
              <ShieldQuestion size={14} className="mt-0.5 shrink-0 text-amber-700" />
              <div>
                <div className="font-medium text-amber-900">Identity check</div>
                <div className="text-amber-800 mt-0.5">{p.identityNotes}</div>
                <div className="text-amber-700 mt-1">
                  If this isn't the right person, click the × to remove and re-add with more
                  context (e.g. middle initial, exact role).
                </div>
              </div>
            </div>
          )}

          <Section icon={<MessageSquare size={14} />} title="Talking points" items={p.talkingPoints} highlight />
          <Section icon={<Handshake size={14} />} title="Conversation starters" items={p.conversationStarters} />

          {(expanded || (p.publicQuotes?.length ?? 0) > 0) && (
            <>
              {p.publicQuotes && p.publicQuotes.length > 0 && (
                <div>
                  <SectionHeader icon={<Quote size={14} />} title="In their own words" />
                  <ul className="space-y-2 mt-2">
                    {p.publicQuotes.slice(0, expanded ? undefined : 2).map((q, i) => (
                      <li key={i} className="text-sm border-l-2 border-neutral-300 pl-3">
                        <span className="italic">"{q.quote}"</span>
                        {(q.context || q.date) && (
                          <div className="text-[11px] text-neutral-500 mt-0.5">
                            {[q.context, q.date].filter(Boolean).join(' · ')}
                            {q.url && (
                              <>
                                {' '}
                                · <a href={q.url} target="_blank" rel="noreferrer" className="hover:underline">
                                  source
                                </a>
                              </>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {expanded && (
            <>
              <Section title="Priorities" items={p.priorities} />
              <Section title="Owns / responsible for" items={p.responsibilities} />
              <Section icon={<AlertTriangle size={14} />} title="Likely objections" items={p.potentialObjections} />
              <Section title="Common ground" items={p.commonGround} />

              {p.previousRoles && p.previousRoles.length > 0 && (
                <div>
                  <SectionHeader title="Previous roles" />
                  <ul className="text-sm mt-2 space-y-1">
                    {p.previousRoles.map((r, i) => (
                      <li key={i} className="text-neutral-800">
                        <span className="font-medium">{r.role}</span>, {r.org}
                        {r.period && <span className="text-neutral-500"> · {r.period}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {p.recentActivity && p.recentActivity.length > 0 && (
                <div>
                  <SectionHeader title="Recent activity" />
                  <ul className="text-sm mt-2 space-y-2">
                    {p.recentActivity.map((a, i) => (
                      <li key={i}>
                        <div className="font-medium">
                          {a.url ? (
                            <a href={a.url} target="_blank" rel="noreferrer" className="hover:underline">
                              {a.title}
                            </a>
                          ) : (
                            a.title
                          )}
                          {a.date && <span className="font-normal text-neutral-500"> · {a.date}</span>}
                        </div>
                        <div className="text-xs text-neutral-600 mt-0.5">{a.summary}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {p.sources && p.sources.length > 0 && (
                <div>
                  <SectionHeader title="Sources" />
                  <ul className="text-[11px] text-neutral-600 mt-2 space-y-1">
                    {p.sources.slice(0, 10).map((s, i) => (
                      <li key={i}>
                        <a href={s.uri} target="_blank" rel="noreferrer" className="hover:underline">
                          {s.title || s.uri}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => setExpanded((x) => !x)}
            className="text-xs text-neutral-600 hover:text-black inline-flex items-center gap-1"
          >
            {expanded ? (
              <>
                <ChevronUp size={14} /> Show less
              </>
            ) : (
              <>
                <ChevronDown size={14} /> Show full dossier
              </>
            )}
          </button>
        </div>
      )}
    </article>
  )
}

function SectionHeader({ icon, title }: { icon?: React.ReactNode; title: string }) {
  return (
    <div className="text-[10px] uppercase tracking-widest text-neutral-500 inline-flex items-center gap-1">
      {icon}
      {title}
    </div>
  )
}

function Section({
  icon,
  title,
  items,
  highlight,
}: {
  icon?: React.ReactNode
  title: string
  items?: string[]
  highlight?: boolean
}) {
  if (!items || items.length === 0) return null
  return (
    <div className={highlight ? 'bg-neutral-50 p-3 -mx-3' : ''}>
      <SectionHeader icon={icon} title={title} />
      <ul className="mt-1.5 space-y-1.5 text-sm">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-neutral-400 mt-0.5">·</span>
            <span className="text-neutral-800">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ConfidenceBadge({ level }: { level: PlayMaker['confidence'] }) {
  const style = {
    high: 'bg-emerald-100 text-emerald-800',
    medium: 'bg-amber-100 text-amber-800',
    low: 'bg-red-100 text-red-800',
  }[level]
  const label = { high: 'High match', medium: 'Likely match', low: 'Low confidence' }[level]
  return (
    <span className={`px-1.5 py-0.5 text-[10px] uppercase tracking-widest font-semibold ${style}`}>
      {label}
    </span>
  )
}
