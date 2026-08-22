/**
 * Live probe: pull Open Dental Family Module insurance for an AFD patient and sync into CRM.
 *
 *   npx tsx --env-file=.env.vercel.runtime scripts/probe-od-insurance-sync.ts [patientIdOrPatNum]
 */
import { prisma } from '../src/lib/db'
import { getOpenDentalClient, getOpenDentalConnection } from '../src/lib/integrations/opendental/factory'
import { syncOpenDentalInsuranceForPatient } from '../src/lib/integrations/opendental/insuranceSync'

const PRACTICE_ID = '6a10eff8-e984-40ab-984b-57880defe60a'
const arg = process.argv[2]?.trim()

async function resolvePatient() {
  if (arg) {
    if (arg.includes('-')) {
      return prisma.patient.findFirst({
        where: { id: arg, practiceId: PRACTICE_ID, deletedAt: null },
        select: {
          id: true,
          name: true,
          externalEhrId: true,
          insuranceStatus: true,
          primaryInsuranceId: true,
          _count: { select: { insurancePolicies: true } },
        },
      })
    }
    return prisma.patient.findFirst({
      where: { practiceId: PRACTICE_ID, externalEhrId: `opendental:${arg}`, deletedAt: null },
      select: {
        id: true,
        name: true,
        externalEhrId: true,
        insuranceStatus: true,
        primaryInsuranceId: true,
        _count: { select: { insurancePolicies: true } },
      },
    })
  }

  // Prefer a patient that already has OD link and recent appointments (more likely to have insurance).
  const withAppt = await prisma.patient.findFirst({
    where: {
      practiceId: PRACTICE_ID,
      deletedAt: null,
      externalEhrId: { startsWith: 'opendental:' },
      appointments: { some: {} },
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      externalEhrId: true,
      insuranceStatus: true,
      primaryInsuranceId: true,
      _count: { select: { insurancePolicies: true } },
    },
  })
  if (withAppt) return withAppt

  return prisma.patient.findFirst({
    where: {
      practiceId: PRACTICE_ID,
      deletedAt: null,
      externalEhrId: { startsWith: 'opendental:' },
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      externalEhrId: true,
      insuranceStatus: true,
      primaryInsuranceId: true,
      _count: { select: { insurancePolicies: true } },
    },
  })
}

async function main() {
  const connection = await getOpenDentalConnection(PRACTICE_ID)
  console.log('OD connection:', {
    active: connection?.isActive ?? false,
    displayName: connection?.displayName,
    baseUrl: connection?.baseUrl,
  })

  const patient = await resolvePatient()
  if (!patient?.externalEhrId) {
    throw new Error('No Open Dental-linked AFD patient found')
  }

  const patNum = patient.externalEhrId.slice('opendental:'.length)
  console.log('Patient before sync:', {
    id: patient.id,
    name: patient.name,
    externalEhrId: patient.externalEhrId,
    insuranceStatus: patient.insuranceStatus,
    policyCount: patient._count.insurancePolicies,
  })

  const client = await getOpenDentalClient(PRACTICE_ID)
  const raw = await client.get(`familymodules/${patNum}/Insurance`)
  const rows = Array.isArray(raw) ? raw : raw ? [raw] : []
  console.log(`Raw OD FamilyModules insurance rows: ${rows.length}`)
  for (const row of rows as Array<Record<string, unknown>>) {
    console.log('  OD row:', {
      PatPlanNum: row.PatPlanNum,
      Ordinal: row.Ordinal,
      CarrierName: row.CarrierName,
      SubscriberID: row.SubscriberID,
      PatID: row.PatID,
      GroupNum: row.GroupNum,
      GroupName: row.GroupName,
      Relationship: row.Relationship,
      PlanType: row.PlanType,
      planType: row.planType,
    })
  }

  const result = await syncOpenDentalInsuranceForPatient({
    practiceId: PRACTICE_ID,
    patientId: patient.id,
    externalEhrId: patient.externalEhrId,
    actorUserId: 'probe-od-insurance-sync',
  })
  console.log('Sync result:', JSON.stringify(result, null, 2))

  const policies = await prisma.insurancePolicy.findMany({
    where: { patientId: patient.id, practiceId: PRACTICE_ID },
    orderBy: [{ isPrimary: 'desc' }],
    select: {
      id: true,
      payerNameRaw: true,
      memberId: true,
      groupNumber: true,
      planName: true,
      planType: true,
      isPrimary: true,
      subscriberIsPatient: true,
      insurerPhoneRaw: true,
      availityPayerId: true,
      relationshipToPatient: true,
    },
  })
  console.log('CRM policies after sync:', JSON.stringify(policies, null, 2))
}

main()
  .catch((error) => {
    console.error('FAILED:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
