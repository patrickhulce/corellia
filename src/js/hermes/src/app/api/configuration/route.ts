import {getConfiguration} from '@/lib/server/configuration'
import {NextResponse} from 'next/server'

export async function GET() {
  const config = await getConfiguration()
  return NextResponse.json(config)
}
