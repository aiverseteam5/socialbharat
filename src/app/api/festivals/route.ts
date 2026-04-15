import { NextRequest, NextResponse } from 'next/server'
import { getUpcomingFestivals } from '@/lib/festivals'

/**
 * GET /api/festivals
 * Get upcoming festivals
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '14', 10)
    
    const festivals = await getUpcomingFestivals(days)
    
    return NextResponse.json({ festivals })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch festivals' },
      { status: 500 }
    )
  }
}
