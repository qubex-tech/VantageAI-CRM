-- Retell web chat widget public key (optional per practice)
ALTER TABLE "retell_integrations"
ADD COLUMN "portalChatPublicKey" TEXT;
