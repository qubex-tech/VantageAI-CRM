import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { researchProspect } from './research.js'
import { researchPlayMakers } from './playmakers.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    hasExaKey: Boolean(process.env.EXA_API_KEY),
  })
})

app.post('/api/research', async (req, res) => {
  try {
    const { prospectName } = req.body ?? {}
    if (typeof prospectName !== 'string' || prospectName.trim().length < 2) {
      return res.status(400).json({ ok: false, error: 'prospectName is required' })
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        ok: false,
        error: 'Server is missing GEMINI_API_KEY. Set it in roi-calculator/.env and restart.',
      })
    }
    const research = await researchProspect(prospectName.trim())
    res.json({ ok: true, research })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[/api/research]', err)
    res.status(500).json({ ok: false, error: message })
  }
})

app.post('/api/playmakers', async (req, res) => {
  try {
    const { names, company } = req.body ?? {}
    if (!Array.isArray(names) || names.length === 0) {
      return res.status(400).json({ ok: false, error: 'names[] is required' })
    }
    const cleaned = names
      .map((n) => (typeof n === 'string' ? n.trim() : ''))
      .filter((n) => n.length >= 2)
      .slice(0, 10) // sane upper bound per request
    if (cleaned.length === 0) {
      return res.status(400).json({ ok: false, error: 'no usable names provided' })
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        ok: false,
        error: 'Server is missing GEMINI_API_KEY. Set it in roi-calculator/.env and restart.',
      })
    }
    const playMakers = await researchPlayMakers(
      cleaned,
      typeof company === 'string' && company.trim().length > 0 ? company.trim() : undefined,
    )
    res.json({ ok: true, playMakers })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[/api/playmakers]', err)
    res.status(500).json({ ok: false, error: message })
  }
})

// In production, serve the built Vite app
if (process.env.NODE_ENV === 'production') {
  const dist = path.resolve(__dirname, '../dist')
  app.use(express.static(dist))
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

const port = Number(process.env.PORT ?? 8787)
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on http://localhost:${port}`)
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[server] GEMINI_API_KEY is not set — /api/research and /api/playmakers will return 500.')
  }
  if (!process.env.EXA_API_KEY) {
    console.warn('[server] EXA_API_KEY is not set — play-maker research will work but skip Exa evidence.')
  }
})
