import { NextResponse } from 'next/server';
import type { ProviderName } from '@/server/providers/types';

const DEFAULT_PROVIDER: ProviderName = (process.env.DEFAULT_PROVIDER as ProviderName) ?? 'openai';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    provider: DEFAULT_PROVIDER
  });
}
