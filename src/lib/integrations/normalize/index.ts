export function normalizePatient(fhirPatient: any) {
  const name = Array.isArray(fhirPatient?.name) ? fhirPatient.name[0] : undefined
  const telecom = Array.isArray(fhirPatient?.telecom) ? fhirPatient.telecom : []
  const phone = telecom.find((t: any) => t.system === 'phone')?.value
  const email = telecom.find((t: any) => t.system === 'email')?.value

  return {
    externalEhrId: fhirPatient?.id,
    firstName: name?.given?.[0] || undefined,
    lastName: name?.family || undefined,
    dateOfBirth: fhirPatient?.birthDate || undefined,
    gender: fhirPatient?.gender || undefined,
    phone,
    email,
    addressLine1: fhirPatient?.address?.[0]?.line?.[0],
    city: fhirPatient?.address?.[0]?.city,
    state: fhirPatient?.address?.[0]?.state,
    postalCode: fhirPatient?.address?.[0]?.postalCode,
  }
}

export function normalizeDocumentReference(docRef: any) {
  return {
    externalEhrId: docRef?.id,
    status: docRef?.status,
    title: docRef?.title || docRef?.type?.text,
    date: docRef?.date,
    patientReference: docRef?.subject?.reference,
  }
}

export function normalizeEncounter(encounter: any) {
  return {
    externalEhrId: encounter?.id,
    status: encounter?.status,
    type: encounter?.type?.[0]?.text,
    periodStart: encounter?.period?.start,
    periodEnd: encounter?.period?.end,
    patientReference: encounter?.subject?.reference,
  }
}
