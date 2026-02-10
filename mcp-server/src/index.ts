import 'dotenv/config'
import express from 'express'
import mcpRoutes from './routes/mcp.js'
import { requireMcpAuth } from './middleware/auth.js'

const PORT = Number(process.env.PORT) || 4010

const app = express()
app.use(express.json({ limit: '256kb' }))

app.get('/mcp/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/mcp', requireMcpAuth, mcpRoutes)

app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } })
})

app.listen(PORT, () => {
  console.log(`MCP Verification Server listening on port ${PORT}`)
})
