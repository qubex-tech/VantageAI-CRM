import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.EHR_BACKEND_API_KEY
  return NextResponse.json({
    hasKey: Boolean(apiKey && apiKey.trim().length > 0),
    length: apiKey ? apiKey.trim().length : 0,
  })
}
