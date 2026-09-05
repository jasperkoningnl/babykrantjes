import { NextRequest, NextResponse } from 'next/server'
import { processNextPaperGenerationJob } from '@/lib/paperGeneration'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Niet toegestaan' }, { status: 401 })
  }
  const processed = await processNextPaperGenerationJob()
  return NextResponse.json({ processed })
}
