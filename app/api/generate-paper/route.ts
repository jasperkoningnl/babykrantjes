import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Gebruik de idempotente route /api/paper-jobs' },
    { status: 410 }
  )
}
