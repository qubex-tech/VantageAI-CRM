import { prisma } from '@/lib/db'

export async function isAriaScribeEnabled(practiceId: string | null | undefined): Promise<boolean> {
  if (!practiceId) return false
  const settings = await prisma.practiceSettings.findUnique({
    where: { practiceId },
    select: { ariaScribeEnabled: true },
  })
  return Boolean(settings?.ariaScribeEnabled)
}

export function ariaDisabledResponse() {
  return {
    error: 'Aria is not enabled for this practice',
    code: 'ARIA_DISABLED' as const,
  }
}
