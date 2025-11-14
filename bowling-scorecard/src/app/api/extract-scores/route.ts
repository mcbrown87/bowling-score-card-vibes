import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { BOWLING_EXTRACTION_PROMPT } from '@/server/prompts/bowling';
import { runProvider } from '@/server/providers';
import type { ProviderName } from '@/server/providers/types';
import { logger } from '@/server/utils/logger';
import { normalizeImageDataUrl } from '@/server/utils/image';

const DEFAULT_PROVIDER: ProviderName = (process.env.DEFAULT_PROVIDER as ProviderName) ?? 'openai';
const INCLUDE_LLM_RAW = process.env.INCLUDE_LLM_RAW === 'true';

const requestSchema = z.object({
  imageDataUrl: z
    .string()
    .regex(/^data:.*;base64,/u, 'imageDataUrl must be a base64 data URL'),
  provider: z.enum(['anthropic', 'openai']).optional(),
  prompt: z.string().optional()
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const requestId = randomUUID();

  try {
    const json = await request.json();
    const parsed = requestSchema.parse(json);
    const provider = parsed.provider ?? DEFAULT_PROVIDER;

    const [prefix, base64Payload] = parsed.imageDataUrl.split(',', 2);
    const imageMetadata = prefix?.split(';')[0]?.replace('data:', '') ?? 'unknown';
    const base64Length = base64Payload?.length ?? 0;
    const estimatedBytes = Math.ceil((base64Length * 3) / 4);

    logger.info('Processing extract-scores request', {
      provider,
      requestId,
      imageMetadata,
      base64Length,
      estimatedBytes,
      includeRawResponse: INCLUDE_LLM_RAW
    });

    const normalizedImage = await normalizeImageDataUrl(parsed.imageDataUrl);

    const result = await runProvider(provider, {
      imageDataUrl: normalizedImage.dataUrl,
      prompt: parsed.prompt ?? BOWLING_EXTRACTION_PROMPT
    });

    logger.info('Extracted bowling scores successfully', {
      provider,
      requestId,
      gameCount: result.games.length,
      convertedImage: normalizedImage.converted
    });

    return NextResponse.json({
      success: true,
      provider,
      games: result.games,
      normalizedImageDataUrl: normalizedImage.dataUrl,
      rawResponse: INCLUDE_LLM_RAW ? result.rawText : undefined
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const statusCode = message.includes('Missing') ? 500 : 400;

    logger.error('Failed to extract bowling scores', error, {
      statusCode,
      requestId
    });

    return NextResponse.json(
      {
        success: false,
        error: message
      },
      { status: statusCode }
    );
  }
}
