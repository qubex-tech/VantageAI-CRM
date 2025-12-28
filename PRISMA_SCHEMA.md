# Prisma Schema Outline

## Models Overview

### 1. Practice (Tenant)
- `id` (String, @id, @default(uuid))
- `name` (String)
- `email` (String, optional)
- `phone` (String, optional)
- `address` (String, optional)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)
- Relations: users, patients, appointments, calIntegrations, voiceConversations

### 2. User
- `id` (String, @id, @default(uuid))
- `email` (String, @unique)
- `passwordHash` (String)
- `name` (String)
- `role` (String) // 'admin', 'staff', 'provider'
- `practiceId` (String, FK → Practice)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)
- Relations: practice, auditLogs

### 3. Patient
- `id` (String, @id, @default(uuid))
- `practiceId` (String, FK → Practice)
- `name` (String)
- `dateOfBirth` (DateTime)
- `phone` (String)
- `email` (String, optional)
- `address` (String, optional)
- `preferredContactMethod` (String) // 'phone', 'email', 'sms'
- `notes` (String, optional)
- `deletedAt` (DateTime, optional)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)
- Relations: practice, insurancePolicies, appointments, voiceConversations, patientTags, timelineEntries

### 4. PatientTag
- `id` (String, @id, @default(uuid))
- `patientId` (String, FK → Patient)
- `tag` (String)
- Index: [patientId, tag]

### 5. InsurancePolicy
- `id` (String, @id, @default(uuid))
- `practiceId` (String, FK → Practice)
- `patientId` (String, FK → Patient)
- `providerName` (String)
- `planName` (String, optional)
- `memberId` (String)
- `groupId` (String, optional)
- `policyHolderName` (String)
- `policyHolderPhone` (String, optional)
- `eligibilityStatus` (String) // 'active', 'inactive', 'pending', 'unknown'
- `lastVerifiedAt` (DateTime, optional)
- `fileMetadata` (Json, optional) // Store file info (path, size, type) - actual storage TODO
- `createdAt` (DateTime)
- `updatedAt` (DateTime)
- Relations: practice, patient

### 6. Appointment
- `id` (String, @id, @default(uuid))
- `practiceId` (String, FK → Practice)
- `patientId` (String, FK → Patient)
- `providerId` (String, optional) // For future provider assignment
- `status` (String) // 'scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'
- `startTime` (DateTime)
- `endTime` (DateTime)
- `timezone` (String)
- `visitType` (String) // Maps to Cal event type name
- `reason` (String, optional)
- `notes` (String, optional)
- `calEventId` (String, optional) // Cal.com event type ID
- `calBookingId` (String, optional, @unique) // Cal.com booking ID
- `createdAt` (DateTime)
- `updatedAt` (DateTime)
- Relations: practice, patient

### 7. CalIntegration
- `id` (String, @id, @default(uuid))
- `practiceId` (String, FK → Practice, @unique)
- `apiKey` (String) // Encrypted in production
- `calOrganizationId` (String, optional)
- `calTeamId` (String, optional)
- `isActive` (Boolean, @default(true))
- `createdAt` (DateTime)
- `updatedAt` (DateTime)
- Relations: practice, eventTypeMappings

### 8. CalEventTypeMapping
- `id` (String, @id, @default(uuid))
- `practiceId` (String, FK → Practice)
- `calIntegrationId` (String, FK → CalIntegration)
- `visitTypeName` (String) // e.g., "Consultation", "Follow-up"
- `calEventTypeId` (String) // Cal.com event type ID
- `createdAt` (DateTime)
- `updatedAt` (DateTime)
- Relations: practice, calIntegration
- Index: [practiceId, visitTypeName]

### 9. VoiceConversation
- `id` (String, @id, @default(uuid))
- `practiceId` (String, FK → Practice)
- `patientId` (String, FK → Patient, optional)
- `callerPhone` (String)
- `retellCallId` (String, optional)
- `startedAt` (DateTime)
- `endedAt` (DateTime, optional)
- `transcript` (String, optional) // Redacted PHI
- `extractedIntent` (String, optional)
- `outcome` (String, optional) // 'appointment_booked', 'information_only', 'failed', etc.
- `metadata` (Json, optional)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)
- Relations: practice, patient

### 10. AuditLog
- `id` (String, @id, @default(uuid))
- `practiceId` (String, FK → Practice)
- `userId` (String, FK → User)
- `action` (String) // 'create', 'update', 'delete', 'view'
- `resourceType` (String) // 'patient', 'appointment', 'insurance', etc.
- `resourceId` (String)
- `changes` (Json, optional) // Before/after state (redacted)
- `ipAddress` (String, optional)
- `userAgent` (String, optional)
- `createdAt` (DateTime)
- Relations: practice, user
- Index: [practiceId, resourceType, resourceId]

## Indexes
- All `practiceId` fields have indexes
- Unique constraints: User.email, CalIntegration.practiceId, Appointment.calBookingId
- Composite indexes for common queries (practiceId + resourceType, etc.)

## Cascading
- Practice deletion → cascade delete related records (or soft delete)
- Patient deletion → soft delete (set deletedAt)
- Appointment deletion → soft delete preferred

