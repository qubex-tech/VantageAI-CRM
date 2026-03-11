import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')
  const backendApiKey = process.env.EHR_BACKEND_API_KEY
  const normalize = (value: string | null | undefined) => (value ? value.trim() : value)
  const normHeader = normalize(apiKey)
  const normEnv = normalize(backendApiKey)
  return NextResponse.json({
    hasHeader: Boolean(normHeader),
    headerLength: normHeader ? normHeader.length : 0,
    hasEnv: Boolean(normEnv),
    envLength: normEnv ? normEnv.length : 0,
    matchesExact: Boolean(normHeader && normEnv && normHeader === normEnv),
    matchesBearer: Boolean(normHeader && normEnv && normHeader === `Bearer ${normEnv}`),
  })
}
