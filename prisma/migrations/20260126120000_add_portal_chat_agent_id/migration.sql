-- Patient portal Retell chat widget: separate agent from voice/default agentId
ALTER TABLE "retell_integrations"
ADD COLUMN "portalChatAgentId" TEXT;
