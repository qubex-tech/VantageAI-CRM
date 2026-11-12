export const VISIT_TYPE_GROUP_ORDER = ['TV', 'OV'] as const

export type VisitTypeGroupId = (typeof VISIT_TYPE_GROUP_ORDER)[number]

export const VISIT_TYPE_GROUP_LABELS: Record<
  VisitTypeGroupId,
  { label: string; description: string }
> = {
  TV: { label: 'TV', description: 'Televisit' },
  OV: { label: 'OV', description: 'Office Visit' },
}

function normalizeVisitTypeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toUpperCase()
}

/** Televisit names from eCW, including short codes such as TVFU and TVNP. */
export function isTelevisitVisitType(name: string): boolean {
  const upper = normalizeVisitTypeName(name)
  if (!upper || upper === 'EHR APPOINTMENT') return false
  if (upper.includes('TELEVISIT')) return true
  return /(^|[^A-Z])TV(?=$|[^A-Z]|FU|NP)/.test(upper)
}

/** In-office office-visit names. Televisit, ultrasound, infusion, and procedure types stay out. */
export function isOfficeVisitType(name: string): boolean {
  const upper = normalizeVisitTypeName(name)
  if (!upper || upper === 'EHR APPOINTMENT') return false
  if (isTelevisitVisitType(upper)) return false
  if (upper.includes('ULTRASOUND') || /(^|[^A-Z])US($|[^A-Z])/.test(upper)) return false
  if (upper.includes('INFUSION')) return false
  if (upper.includes('VITAMIN') || upper.includes('VITTAMIN') || /(^|[^A-Z])VIT($|[^A-Z])/.test(upper)) {
    return false
  }
  if (upper.includes('MEDICAL ASSISTANT') || /(^|[^A-Z])CMA($|[^A-Z])/.test(upper)) return false
  if (upper.includes('NEW PATIENT')) return true
  if (upper.includes('FOLLOW')) return true
  if (/(^|[^A-Z])NP($|[^A-Z])/.test(upper)) return true
  if (/(^|[^A-Z])F\/U($|[^A-Z])/.test(upper)) return true
  if (/(^|[^A-Z])FUV($|[^A-Z])/.test(upper)) return true
  if (/(^|[^A-Z])FU($|[^A-Z])/.test(upper)) return true
  return false
}

export function classifyVisitTypeGroup(name: string): VisitTypeGroupId | null {
  if (isTelevisitVisitType(name)) return 'TV'
  if (isOfficeVisitType(name)) return 'OV'
  return null
}

export function selectedVisitTypeNames(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

export function groupVisitTypes(names: string[]): {
  groups: Array<{ id: VisitTypeGroupId; label: string; description: string; types: string[] }>
  ungrouped: string[]
} {
  const buckets: Record<VisitTypeGroupId, string[]> = { TV: [], OV: [] }
  const ungrouped: string[] = []
  for (const name of names) {
    const group = classifyVisitTypeGroup(name)
    if (group) buckets[group].push(name)
    else if (name.trim()) ungrouped.push(name)
  }
  return {
    groups: VISIT_TYPE_GROUP_ORDER.filter((id) => buckets[id].length > 0).map((id) => ({
      id,
      ...VISIT_TYPE_GROUP_LABELS[id],
      types: buckets[id],
    })),
    ungrouped,
  }
}
