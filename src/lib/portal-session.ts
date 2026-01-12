import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { prisma } from './db'

/**
 * Get patient ID from session cookie
 */
export async function getPatientSession(req?: NextRequest): Promise<{ patientId: string; practiceId: string } | null> {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('portal_session')?.value

    if (!sessionToken) {
      return null
    }

    // Parse session token: patientId:practiceId:timestamp
    const [patientId, practiceId] = sessionToken.split(':')

    if (!patientId || !practiceId) {
      return null
    }

    // Verify patient exists and belongs to practice
    const patient = await prisma.patient.findUnique({
      where: {
        id: patientId,
        practiceId,
      },
    })

    if (!patient) {
      return null
    }

    return { patientId, practiceId }
  } catch (error) {
    return null
  }
}

/**
 * Require patient session
 * Throws error if no valid session
 */
export async function requirePatientSession(req?: NextRequest): Promise<{ patientId: string; practiceId: string }> {
  const session = await getPatientSession(req)
  if (!session) {
    throw new Error('Unauthorized')
  }
  return session
}

/**
 * Clear patient session
 */
export async function clearPatientSession() {
  const cookieStore = await cookies()
  cookieStore.delete('portal_session')
}
