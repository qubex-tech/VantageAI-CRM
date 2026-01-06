import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { runAutomationsForEvent } from '@/inngest/functions'

// Export runtime configuration for Edge/Serverless
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Serve Inngest functions - this endpoint must be publicly accessible
// Inngest will call this endpoint to register functions and trigger executions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [runAutomationsForEvent],
})

