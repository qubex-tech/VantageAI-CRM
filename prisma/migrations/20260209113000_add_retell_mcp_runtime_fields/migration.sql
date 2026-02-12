ALTER TABLE "retell_integrations"
ADD COLUMN "mcpBaseUrl" TEXT,
ADD COLUMN "mcpApiKey" TEXT,
ADD COLUMN "mcpActorId" TEXT,
ADD COLUMN "mcpRequestIdPrefix" TEXT,
ADD COLUMN "outboundToolName" TEXT;
