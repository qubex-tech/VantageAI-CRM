import { prisma } from '@/lib/db'
import type { OpenSlotSource, OpenTimeSlot } from '@/lib/appointment-optimization/types'

function rowToOpenTimeSlot(row: {
  id: string
  practiceId: string
  visitType: string
  providerId: string | null
  slotStart: Date
  slotEnd: Date
  openSlotSource: string
  sourceAppointmentId: string | null
  origin: unknown
}): OpenTimeSlot {
  const origin =
    row.origin && typeof row.origin === 'object'
      ? (row.origin as OpenTimeSlot['origin'])
      : undefined
  return {
    practiceId: row.practiceId,
    visitType: row.visitType,
    providerId: row.providerId,
    start: row.slotStart,
    end: row.slotEnd,
    openSlotSource: row.openSlotSource as OpenSlotSource,
    sourceAppointmentId: row.sourceAppointmentId,
    inventoryId: row.id,
    origin,
  }
}

export async function ingestOpenTimeSlot(slot: OpenTimeSlot): Promise<{ id: string }> {
  const row = await prisma.openSlotInventory.create({
    data: {
      practiceId: slot.practiceId,
      visitType: slot.visitType,
      providerId: slot.providerId,
      slotStart: slot.start,
      slotEnd: slot.end,
      openSlotSource: slot.openSlotSource ?? 'availability',
      sourceAppointmentId: slot.sourceAppointmentId ?? null,
      origin: slot.origin ?? undefined,
      status: 'pending',
    },
    select: { id: true },
  })
  return { id: row.id }
}

export async function listPendingOpenTimeSlots(practiceId: string): Promise<OpenTimeSlot[]> {
  const rows = await prisma.openSlotInventory.findMany({
    where: { practiceId, status: 'pending' },
    orderBy: { slotStart: 'asc' },
  })
  return rows.map(rowToOpenTimeSlot)
}

export async function markOpenTimeSlotProcessed(
  inventoryId: string,
  result: { status: 'processed' | 'skipped'; openSlotEventId?: string }
) {
  await prisma.openSlotInventory.update({
    where: { id: inventoryId },
    data: {
      status: result.status,
      openSlotEventId: result.openSlotEventId ?? null,
      processedAt: new Date(),
    },
  })
}
