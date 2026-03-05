ALTER TABLE "retell_integrations"
ADD COLUMN "curogramEscalationEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "curogramEscalationUrl" TEXT;
