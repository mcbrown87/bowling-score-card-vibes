import { Readable } from 'node:stream';
import type { Prisma } from '@prisma/client';

import { BOWLING_EXTRACTION_PROMPT } from '@/server/prompts/bowling';
import { prisma } from '@/server/db/client';
import { runProvider } from '@/server/providers';
import type { ProviderName } from '@/server/providers/types';
import { getObject } from '@/server/storage/client';
import { normalizeImageDataUrl } from '@/server/utils/image';
import { logger } from '@/server/utils/logger';

export const DEFAULT_PROVIDER: ProviderName =
  (process.env.DEFAULT_PROVIDER as ProviderName) ?? 'openai';
export const PROVIDER_MODELS: Record<ProviderName, string> = {
  anthropic: process.env.ANTHROPIC_MODEL ?? 'claude-3-7-sonnet-latest',
  openai: process.env.OPENAI_MODEL ?? 'gpt-4o',
  stub: 'dev-stub'
};
export const INCLUDE_LLM_RAW = process.env.INCLUDE_LLM_RAW === 'true';
export const PROMPT_VERSION = process.env.BOWLING_PROMPT_VERSION ?? 'bowling-v1';

export type ScoreEstimatorJobPayload = {
  storedImageId: string;
  llmRequestId: string;
};

const readBodyToBuffer = async (body: unknown): Promise<Buffer> => {
  if (!body) {
    throw new Error('Storage returned an empty body');
  }

  if (body instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk as Buffer));
    }
    return Buffer.concat(chunks);
  }

  const transformable = body as { transformToByteArray?: () => Promise<Uint8Array> };
  if (typeof transformable.transformToByteArray === 'function') {
    const byteArray = await transformable.transformToByteArray();
    return Buffer.from(byteArray);
  }

  if (Buffer.isBuffer(body)) {
    return body;
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  if (typeof body === 'string') {
    return Buffer.from(body);
  }

  throw new Error('Unsupported storage body type');
};

export const processScoreEstimatorJob = async ({
  storedImageId,
  llmRequestId
}: ScoreEstimatorJobPayload) => {
  let requestStartedAt: Date | null = null;

  try {
    const storedImage = await prisma.storedImage.findUnique({
      where: { id: storedImageId },
      select: {
        id: true,
        userId: true,
        bucket: true,
        objectKey: true,
        originalFileName: true,
        contentType: true,
        sizeBytes: true,
        createdAt: true
      }
    });

    if (!storedImage) {
      throw new Error('Stored image not found');
    }

    const llmRequest = await prisma.lLMRequest.findUnique({
      where: { id: llmRequestId },
      select: {
        id: true,
        storedImageId: true,
        provider: true,
        model: true,
        promptId: true
      }
    });

    if (!llmRequest || llmRequest.storedImageId !== storedImage.id) {
      throw new Error('LLM request not found for stored image');
    }

    const provider = (llmRequest.provider as ProviderName) ?? DEFAULT_PROVIDER;
    const providerModel = llmRequest.model ?? PROVIDER_MODELS[provider];
    const object = await getObject({ Key: storedImage.objectKey });

    if (!object.Body) {
      throw new Error('Storage returned an empty body');
    }

    const bodyBuffer = await readBodyToBuffer(object.Body);
    const mediaType = storedImage.contentType ?? 'image/jpeg';
    const dataUrl = `data:${mediaType};base64,${bodyBuffer.toString('base64')}`;
    const normalizedImage = await normalizeImageDataUrl(dataUrl);

    const rawRequestData: Prisma.JsonObject = {
      prompt: BOWLING_EXTRACTION_PROMPT,
      providerModel,
      existingStoredImage: storedImage.id,
      convertedImage: normalizedImage.converted
    };

    requestStartedAt = new Date();
    await prisma.lLMRequest.update({
      where: { id: llmRequestId },
      data: {
        status: 'pending',
        startedAt: requestStartedAt,
        rawRequest: rawRequestData
      }
    });

    const result = await runProvider(provider, {
      imageDataUrl: normalizedImage.dataUrl,
      prompt: BOWLING_EXTRACTION_PROMPT
    });

    const completedAt = new Date();
    const durationMs = requestStartedAt ? completedAt.getTime() - requestStartedAt.getTime() : null;
    const rawTextForStorage = INCLUDE_LLM_RAW ? result.rawText : null;

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

    await prisma.bowlingScore.deleteMany({
      where: { storedImageId: storedImage.id, isEstimate: true }
    });

    if (result.games.length > 0) {
      await prisma.bowlingScore.createMany({
        data: result.games.map((game, index) => ({
          storedImageId: storedImage.id,
          llmRequestId,
          gameIndex: index,
          playerName: game.playerName,
          totalScore: game.totalScore,
          frames: game.frames as unknown as Prisma.InputJsonValue,
          tenthFrame: game.tenthFrame as unknown as Prisma.InputJsonValue,
          provider,
          isEstimate: true,
          rawText: rawTextForStorage
        }))
      });
    }

    logger.info('Regenerated bowling scores for stored image', {
      storedImageId: storedImage.id,
      provider,
      gameCount: result.games.length
    });

    return {
      storedImageId: storedImage.id,
      games: result.games.length
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate score estimate';
    const completedAt = new Date();
    const durationMs = requestStartedAt ? completedAt.getTime() - requestStartedAt.getTime() : null;

    await prisma.lLMRequest.update({
      where: { id: llmRequestId },
      data: {
        completedAt,
        durationMs: durationMs ?? undefined,
        status: 'failed',
        errorMessage: message
      }
    });

    logger.error('Failed to regenerate bowling scores', error, {
      storedImageId,
      llmRequestId
    });

    throw error;
  }
};
