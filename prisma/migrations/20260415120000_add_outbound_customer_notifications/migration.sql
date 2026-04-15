-- Outbound customer notification preferences (Vantage Admin / practice-scoped)
ALTER TABLE "practice_settings" ADD COLUMN "outboundCustomerNotifications" JSONB;
