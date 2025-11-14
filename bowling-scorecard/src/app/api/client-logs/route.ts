import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/server/utils/logger';

const clientLogSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  message: z.string().min(1),
  stack: z.string().optional(),
  context: z.record(z.any()).optional()
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const requestId = randomUUID();

  try {
    const json = await request.json();
    const payload = clientLogSchema.parse(json);
    const userAgent = request.headers.get('user-agent') ?? 'unknown';

    const attributes = {
      ...payload.context,
      requestId,
      userAgent,
      clientStack: payload.stack,
      source: 'client'
    };

    switch (payload.level) {
      case 'error':
        logger.error(payload.message, undefined, attributes);
        break;
      case 'warn':
        logger.warn(payload.message, attributes);
        break;
      case 'debug':
        logger.debug(payload.message, attributes);
        break;
      default:
        logger.info(payload.message, attributes);
        break;
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.warn('Invalid client log payload', {
      error: error instanceof Error ? error.message : 'unknown',
      requestId
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid client log payload'
      },
      { status: 400 }
    );
  }
}
