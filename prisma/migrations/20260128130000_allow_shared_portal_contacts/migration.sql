-- Allow shared contact info across patient portal accounts
-- Drop unique constraints on email/phone for patient_accounts

DROP INDEX IF EXISTS "patient_accounts_email_key";
DROP INDEX IF EXISTS "patient_accounts_phone_key";
