import { NextResponse } from 'next/server';
import { getRuntimeSettings } from '@/server/config/appConfig';

export const dynamic = 'force-dynamic';

export async function GET() {
  const settings = await getRuntimeSettings();

  return NextResponse.json({
    status: 'ok',
    provider: settings.activeProvider
  });
}
