-- Allow Twilio to take priority over Telnyx when using a custom (non-Telnyx) From Number
ALTER TABLE "twilio_integrations" ADD COLUMN "preferForSmsOutbound" BOOLEAN NOT NULL DEFAULT false;
