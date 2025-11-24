import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { BOWLING_EXTRACTION_PROMPT } from '@/server/prompts/bowling';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { runProvider } from '@/server/providers';
import type { ProviderName } from '@/server/providers/types';
import { uploadObject, getStorageBucket } from '@/server/storage/client';
import { logger } from '@/server/utils/logger';
import { dataUrlToBuffer, normalizeImageDataUrl } from '@/server/utils/image';

const DEFAULT_PROVIDER: ProviderName = (process.env.DEFAULT_PROVIDER as ProviderName) ?? 'openai';
const INCLUDE_LLM_RAW = process.env.INCLUDE_LLM_RAW === 'true';
const PROVIDER_MODELS: Record<ProviderName, string> = {
  anthropic: process.env.ANTHROPIC_MODEL ?? 'claude-3-7-sonnet-latest',
  openai: process.env.OPENAI_MODEL ?? 'gpt-4o'
};
const PROMPT_VERSION = process.env.BOWLING_PROMPT_VERSION ?? 'bowling-v1';

const requestSchema = z.object({
  imageDataUrl: z
    .string()
    .regex(/^data:.*;base64,/u, 'imageDataUrl must be a base64 data URL'),
  provider: z.enum(['anthropic', 'openai']).optional(),
  prompt: z.string().optional(),
  fileName: z.string().optional()
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const requestId = randomUUID();
  let llmRequestId: string | null = null;
  let requestStartedAt: Date | null = null;

  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        {
          status: 401
        }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        {
          status: 401
        }
      );
    }

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
    const { buffer: imageBuffer, mediaType } = dataUrlToBuffer(normalizedImage.dataUrl);
    const fileExtension = (() => {
      const lowered = mediaType.toLowerCase();
      if (lowered.includes('png')) return 'png';
      if (lowered.includes('webp')) return 'webp';
      if (lowered.includes('gif')) return 'gif';
      return 'jpg';
    })();
    const objectKey = `users/${user.id}/${requestId}.${fileExtension}`;

    await uploadObject({
      Body: imageBuffer,
      ContentType: mediaType,
      Key: objectKey
    });

    const storedImage = await prisma.storedImage.create({
      data: {
        userId: user.id,
        bucket: getStorageBucket(),
        objectKey,
        originalFileName: parsed.fileName ?? null,
        contentType: mediaType,
        sizeBytes: imageBuffer.length
      }
    });

    requestStartedAt = new Date();
    const providerModel = PROVIDER_MODELS[provider];
    const requestPrompt = parsed.prompt ?? BOWLING_EXTRACTION_PROMPT;

    const rawRequestData: Prisma.JsonObject = {
      prompt: requestPrompt,
      providerModel,
      imageMetadata,
      convertedImage: normalizedImage.converted
    };

    const [promptRecord] = await prisma.$transaction([
      prisma.prompt.upsert({
        where: { version: PROMPT_VERSION },
        update: { content: requestPrompt },
        create: { version: PROMPT_VERSION, content: requestPrompt }
      })
    ]);

    const llmRequest = await prisma.lLMRequest.create({
      data: {
        storedImageId: storedImage.id,
        provider,
        model: providerModel,
        promptId: promptRecord.id,
        status: 'pending',
        startedAt: requestStartedAt,
        rawRequest: rawRequestData
      }
    });
    llmRequestId = llmRequest.id;

    const result = await runProvider(provider, {
      imageDataUrl: normalizedImage.dataUrl,
      prompt: requestPrompt
    });

    logger.info('Extracted bowling scores successfully', {
      provider,
      requestId,
      gameCount: result.games.length,
      convertedImage: normalizedImage.converted
    });

    const completedAt = new Date();
    const durationMs =
      requestStartedAt !== null ? completedAt.getTime() - requestStartedAt.getTime() : null;
    const rawTextForStorage = INCLUDE_LLM_RAW ? result.rawText : null;

    if (llmRequestId) {
      await prisma.lLMRequest.update({
        where: { id: llmRequestId },
        data: {
          completedAt,
          durationMs: durationMs ?? undefined,
          status: 'succeeded',
          model: result.model ?? providerModel,
          rawResponse:
            result.games.length > 0
              ? (result.games as unknown as Prisma.InputJsonValue)
              : undefined,
          rawText: rawTextForStorage
        }
      });
    }

    if (result.games.length > 0) {
      await prisma.bowlingScore.createMany({
        data: result.games.map((game, index) => ({
          storedImageId: storedImage.id,
          llmRequestId: llmRequestId ?? undefined,
          gameIndex: index,
          playerName: game.playerName,
          totalScore: game.totalScore,
          frames: game.frames as unknown as Prisma.InputJsonValue,
          tenthFrame: game.tenthFrame as unknown as Prisma.InputJsonValue,
          issues: (game.issues ?? null) as unknown as Prisma.InputJsonValue,
          confidence: game.confidence ?? null,
          provider,
          isEstimate: true,
          rawText: rawTextForStorage
        }))
      });
    }

    return NextResponse.json({
      success: true,
      provider,
      games: result.games,
      normalizedImageDataUrl: normalizedImage.dataUrl,
      storedImage,
      rawResponse: INCLUDE_LLM_RAW ? result.rawText : undefined
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const statusCode = message.includes('Missing') ? 500 : 400;

    if (llmRequestId) {
      const completedAt = new Date();
      const durationMs =
        requestStartedAt !== null ? completedAt.getTime() - requestStartedAt.getTime() : null;
      await prisma.lLMRequest.update({
        where: { id: llmRequestId },
        data: {
          completedAt,
          durationMs: durationMs ?? undefined,
          status: 'failed',
          errorMessage: message
        }
      });
    }

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
