import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { getRetellClient } from '@/lib/retell-api'
import { extractCallData } from '@/lib/process-call-data'

/**
 * Debug endpoint to inspect call data structure
 * GET /api/debug/call-data?callId=xxx
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const searchParams = req.nextUrl.searchParams
    const callId = searchParams.get('callId')
    
    if (!callId) {
      return NextResponse.json({ error: 'callId query parameter required' }, { status: 400 })
    }
    
    const retellClient = await getRetellClient(user.practiceId)
    const call = await retellClient.getCall(callId)
    
    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }
    
    // Extract data using the extraction function
    const extractedData = extractCallData(call)
    
    return NextResponse.json({
      callId: call.call_id,
      callStatus: call.call_status,
      // Show the raw call structure (without sensitive data)
      callStructure: {
        hasCallAnalysis: !!call.call_analysis,
        callAnalysisKeys: call.call_analysis ? Object.keys(call.call_analysis) : [],
        hasCustomAnalysisData: !!(call.call_analysis as any)?.custom_analysis_data,
        customAnalysisDataKeys: (call.call_analysis as any)?.custom_analysis_data 
          ? Object.keys((call.call_analysis as any).custom_analysis_data)
          : [],
        hasMetadata: !!call.metadata,
        metadataKeys: call.metadata ? Object.keys(call.metadata) : [],
        hasTranscript: !!call.transcript,
        transcriptLength: call.transcript?.length || 0,
      },
      // Show extracted data
      extractedData,
      // Show raw analysis data (sanitized)
      rawAnalysisData: {
        call_summary: (call.call_analysis as any)?.call_summary,
        call_successful: (call.call_analysis as any)?.call_successful,
        custom_analysis_data: (call.call_analysis as any)?.custom_analysis_data,
      },
      // Show metadata
      metadata: call.metadata,
      // Show phone number from call (check metadata as it may be stored there)
      phoneNumber: (call.metadata as any)?.phone_number || (call.metadata as any)?.from_number || 'not found',
    })
  } catch (error) {
    console.error('Error fetching call data:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch call data' },
      { status: 500 }
    )
  }
}

