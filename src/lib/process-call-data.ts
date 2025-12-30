/**
 * Process RetellAI Call Data Extraction
 * 
 * Extracts post-call data and creates/updates patient records
 */

import { prisma } from './db'
import { RetellCall } from './retell-api'
import { createAuditLog } from './audit'

export interface ExtractedCallData {
  call_summary?: string
  call_successful?: boolean | string
  user_age?: string | number
  user_phone_number?: string
  detailed_call_summary?: string
  patient_name?: string
  selected_time?: string
  selected_date?: string
  preferred_dentist?: string
  call_reason?: string
}

/**
 * Extract post-call data from RetellAI call response
 */
export function extractCallData(call: RetellCall): ExtractedCallData {
  const extracted: ExtractedCallData = {}

  // Extract from call_analysis
  if (call.call_analysis) {
    if (call.call_analysis.call_summary) {
      extracted.call_summary = call.call_analysis.call_summary
    }
    if (call.call_analysis.call_successful !== undefined) {
      extracted.call_successful = call.call_analysis.call_successful
    }

    // Check for custom_analysis_data which often contains extracted fields
    if (call.call_analysis.custom_analysis_data) {
      const customData = call.call_analysis.custom_analysis_data as Record<string, any>
      
      console.log('[extractCallData] Found custom_analysis_data:', customData)
      
      // Map common field names - check both exact match and common variations
      if (customData.user_age !== undefined) extracted.user_age = customData.user_age
      if (customData.user_phone_number) extracted.user_phone_number = customData.user_phone_number
      if (customData.detailed_call_summary) extracted.detailed_call_summary = customData.detailed_call_summary
      if (customData.patient_name) extracted.patient_name = customData.patient_name
      if (customData.selected_time) extracted.selected_time = customData.selected_time
      if (customData.selected_date) extracted.selected_date = customData.selected_date
      if (customData.preferred_dentist) extracted.preferred_dentist = customData.preferred_dentist
      if (customData.call_reason) extracted.call_reason = customData.call_reason
      
      // Also check for common variations
      if (!extracted.patient_name && customData.name) extracted.patient_name = customData.name
      if (!extracted.user_phone_number && customData.phone) extracted.user_phone_number = customData.phone
      if (!extracted.user_phone_number && customData.phone_number) extracted.user_phone_number = customData.phone_number
    }
    
    // Also check call_analysis root level for extracted fields (some APIs return them here)
    const analysisData = call.call_analysis as Record<string, any>
    const extractedFields = ['user_age', 'user_phone_number', 'detailed_call_summary', 'patient_name', 
                             'selected_time', 'selected_date', 'preferred_dentist', 'call_reason',
                             'name', 'phone', 'phone_number']
    
    for (const field of extractedFields) {
      if (analysisData[field] !== undefined && analysisData[field] !== null && analysisData[field] !== '') {
        if (field === 'name' && !extracted.patient_name) extracted.patient_name = analysisData[field]
        else if (field === 'phone' && !extracted.user_phone_number) extracted.user_phone_number = analysisData[field]
        else if (field === 'phone_number' && !extracted.user_phone_number) extracted.user_phone_number = analysisData[field]
        else if (!extracted[field as keyof ExtractedCallData]) {
          (extracted as any)[field] = analysisData[field]
        }
      }
    }
  }

  // Check metadata field as fallback
  if (call.metadata) {
    const metadata = call.metadata as Record<string, any>
    
    console.log('[extractCallData] Found metadata:', metadata)
    
    if (!extracted.user_age && metadata.user_age !== undefined) extracted.user_age = metadata.user_age
    if (!extracted.user_phone_number && metadata.user_phone_number) extracted.user_phone_number = metadata.user_phone_number
    if (!extracted.detailed_call_summary && metadata.detailed_call_summary) extracted.detailed_call_summary = metadata.detailed_call_summary
    if (!extracted.patient_name && metadata.patient_name) extracted.patient_name = metadata.patient_name
    if (!extracted.selected_time && metadata.selected_time) extracted.selected_time = metadata.selected_time
    if (!extracted.selected_date && metadata.selected_date) extracted.selected_date = metadata.selected_date
    if (!extracted.preferred_dentist && metadata.preferred_dentist) extracted.preferred_dentist = metadata.preferred_dentist
    if (!extracted.call_reason && metadata.call_reason) extracted.call_reason = metadata.call_reason
    
    // Also check for common variations in metadata
    if (!extracted.patient_name && metadata.name) extracted.patient_name = metadata.name
    if (!extracted.user_phone_number && metadata.phone) extracted.user_phone_number = metadata.phone
    if (!extracted.user_phone_number && metadata.phone_number) extracted.user_phone_number = metadata.phone_number
  }
  
  // Also check root level of call object (some APIs return extracted data here)
  const callData = call as Record<string, any>
  const rootExtractedFields = ['user_age', 'user_phone_number', 'detailed_call_summary', 'patient_name',
                               'selected_time', 'selected_date', 'preferred_dentist', 'call_reason',
                               'name', 'phone', 'phone_number']
  
  for (const field of rootExtractedFields) {
    if (callData[field] !== undefined && callData[field] !== null && callData[field] !== '' && 
        !extracted[field as keyof ExtractedCallData]) {
      if (field === 'name' && !extracted.patient_name) extracted.patient_name = callData[field]
      else if (field === 'phone' && !extracted.user_phone_number) extracted.user_phone_number = callData[field]
      else if (field === 'phone_number' && !extracted.user_phone_number) extracted.user_phone_number = callData[field]
      else {
        (extracted as any)[field] = callData[field]
      }
    }
  }

  console.log('[extractCallData] Final extracted data:', extracted)
  console.log('[extractCallData] Full call object keys:', Object.keys(call))
  if (call.call_analysis) {
    console.log('[extractCallData] call_analysis keys:', Object.keys(call.call_analysis))
  }

  return extracted
}

/**
 * Create or update patient from extracted call data
 */
export async function processCallDataForPatient(
  practiceId: string,
  callData: ExtractedCallData,
  userId: string,
  callId?: string
): Promise<{ patientId: string | null; isNew: boolean }> {
  // Need phone number or patient name to identify/create patient
  const phoneNumber = callData.user_phone_number
  const patientName = callData.patient_name

  // Log extracted data for debugging
  console.log('[processCallDataForPatient] Extracted call data:', {
    patient_name: patientName,
    user_phone_number: phoneNumber,
    user_age: callData.user_age,
    callId,
  })

  if (!phoneNumber && !patientName) {
    console.warn('[processCallDataForPatient] No phone number or patient name in extracted call data, skipping patient creation. Full callData:', callData)
    return { patientId: null, isNew: false }
  }

  // Normalize phone number
  const normalizedPhone = phoneNumber ? phoneNumber.replace(/\D/g, '') : null

  // Try to find existing patient by phone number
  let patient = null
  if (normalizedPhone) {
    patient = await prisma.patient.findFirst({
      where: {
        practiceId,
        phone: normalizedPhone,
        deletedAt: null,
      },
    })

    // If no exact match, try matching with normalized versions
    if (!patient) {
      const allPatients = await prisma.patient.findMany({
        where: {
          practiceId,
          deletedAt: null,
        },
        select: {
          id: true,
          phone: true,
        },
      })

      const matchedPatient = allPatients.find(p => p.phone.replace(/\D/g, '') === normalizedPhone)
      if (matchedPatient) {
        patient = await prisma.patient.findUnique({
          where: { id: matchedPatient.id },
        })
      }
    }
  }

  // Also try to find by name if phone match failed
  if (!patient && patientName) {
    patient = await prisma.patient.findFirst({
      where: {
        practiceId,
        name: {
          contains: patientName,
          mode: 'insensitive',
        },
        deletedAt: null,
      },
    })
  }

  let isNew = false
  const updateData: any = {}

  // Prepare update/create data
  if (patientName && patientName !== patient?.name) {
    updateData.name = patientName
  }

  if (normalizedPhone && normalizedPhone !== patient?.phone) {
    updateData.phone = normalizedPhone
  }

  // Parse age if provided (convert to date of birth estimate)
  if (callData.user_age) {
    const age = typeof callData.user_age === 'string' ? parseInt(callData.user_age) : callData.user_age
    if (!isNaN(age) && age > 0 && age < 150) {
      // Estimate date of birth from age (use Jan 1 of estimated year)
      const currentYear = new Date().getFullYear()
      const estimatedBirthYear = currentYear - age
      updateData.dateOfBirth = new Date(estimatedBirthYear, 0, 1)
    }
  }

  // Store additional extracted data in notes
  const notesParts: string[] = []
  if (callData.call_reason) notesParts.push(`Call reason: ${callData.call_reason}`)
  if (callData.preferred_dentist) notesParts.push(`Preferred dentist: ${callData.preferred_dentist}`)
  if (callData.detailed_call_summary) notesParts.push(`Call details: ${callData.detailed_call_summary}`)
  
  if (notesParts.length > 0) {
    const newNotes = notesParts.join('\n')
    updateData.notes = patient?.notes 
      ? `${patient.notes}\n\n[From call ${callId || 'unknown'}]:\n${newNotes}`
      : `[From call ${callId || 'unknown'}]:\n${newNotes}`
  }

  if (patient) {
    // Update existing patient
    patient = await prisma.patient.update({
      where: { id: patient.id },
      data: updateData,
    })

    // Create audit log
    await createAuditLog({
      practiceId,
      userId,
      action: 'update',
      resourceType: 'patient',
      resourceId: patient.id,
      changes: {
        after: {
          source: 'retell_call',
          callId,
          updatedFields: Object.keys(updateData),
        },
      },
    })

    return { patientId: patient.id, isNew: false }
  } else {
    // Create new patient
    if (!patientName) {
      console.warn('Cannot create patient without name')
      return { patientId: null, isNew: false }
    }

    // Phone is required, use a placeholder if not available
    const phoneForCreation = normalizedPhone || '000-000-0000'

    const newPatient = await prisma.patient.create({
      data: {
        practiceId,
        name: patientName,
        phone: phoneForCreation,
        dateOfBirth: updateData.dateOfBirth || new Date('1900-01-01'),
        preferredContactMethod: 'phone',
        notes: updateData.notes || undefined,
      },
    })

    // Create audit log
    await createAuditLog({
      practiceId,
      userId,
      action: 'create',
      resourceType: 'patient',
      resourceId: newPatient.id,
      changes: {
        after: {
          source: 'retell_call',
          callId,
        },
      },
    })

    return { patientId: newPatient.id, isNew: true }
  }
}

/**
 * Process call data and link to patient
 */
export async function processRetellCallData(
  practiceId: string,
  call: RetellCall,
  userId: string
): Promise<{ patientId: string | null; extractedData: ExtractedCallData }> {
  // Extract data from call
  const extractedData = extractCallData(call)
  
  // Log extracted data for debugging
  console.log('[processRetellCallData] Extracted data from call:', {
    callId: call.call_id,
    extractedData,
    callAnalysis: call.call_analysis,
    metadata: call.metadata,
  })

  // Create or update patient
  const { patientId, isNew } = await processCallDataForPatient(
    practiceId,
    extractedData,
    userId,
    call.call_id
  )
  
  console.log('[processRetellCallData] Patient processing result:', { patientId, isNew })

  // Update or create voice conversation record
  if (call.call_id) {
    const phoneNumber = extractedData.user_phone_number || 'unknown'
    
    // Find existing conversation or create new one
    const existingConversation = await prisma.voiceConversation.findFirst({
      where: {
        practiceId,
        retellCallId: call.call_id,
      },
    })

    if (existingConversation) {
      await prisma.voiceConversation.update({
        where: { id: existingConversation.id },
        data: {
          patientId: patientId || existingConversation.patientId,
          transcript: call.transcript || existingConversation.transcript,
          extractedIntent: extractedData.call_reason || existingConversation.extractedIntent,
          outcome: extractedData.call_successful ? 'appointment_booked' : existingConversation.outcome || 'information_only',
          metadata: extractedData as any,
          endedAt: call.end_timestamp ? new Date(call.end_timestamp) : existingConversation.endedAt,
        },
      })
    } else {
      await prisma.voiceConversation.create({
        data: {
          practiceId,
          patientId: patientId || undefined,
          callerPhone: phoneNumber.replace(/\D/g, ''),
          retellCallId: call.call_id,
          startedAt: call.start_timestamp ? new Date(call.start_timestamp) : new Date(),
          endedAt: call.end_timestamp ? new Date(call.end_timestamp) : undefined,
          transcript: call.transcript || undefined,
          extractedIntent: extractedData.call_reason || undefined,
          outcome: extractedData.call_successful ? 'appointment_booked' : 'information_only',
          metadata: extractedData as any,
        },
      })
    }
  }

  return { patientId, extractedData }
}
