import type { Prisma } from '@prisma/client';

import { BOWLING_EXTRACTION_PROMPT } from '@/server/prompts/bowling';
import { prisma } from '@/server/db/client';
import { getProviderModel, getRuntimeSettings } from '@/server/config/appConfig';
import { runProvider } from '@/server/providers';
import type { ProviderName } from '@/server/providers/types';
import { getObject } from '@/server/storage/client';
import { normalizeImageDataUrl } from '@/server/utils/image';
import { logger } from '@/server/utils/logger';
import { readStorageBodyToBuffer } from '@/server/utils/storageBody';

export const PROVIDER_MODELS: Record<ProviderName, string> = {
  anthropic: process.env.ANTHROPIC_MODEL ?? 'claude-3-7-sonnet-latest',
  local: process.env.LOCAL_MODEL_NAME ?? 'donut-bowling-v1',
  openai: process.env.OPENAI_MODEL ?? 'gpt-4o',
  stub: 'dev-stub'
};
export const INCLUDE_LLM_RAW = process.env.INCLUDE_LLM_RAW === 'true';
export const PROMPT_VERSION = process.env.BOWLING_PROMPT_VERSION ?? 'bowling-v1';

export type ScoreEstimatorJobPayload = {
  storedImageId: string;
  llmRequestId: string;
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

    const settings = await getRuntimeSettings();
    const provider = (llmRequest.provider as ProviderName) ?? settings.activeProvider;
    const providerModel = llmRequest.model ?? (await getProviderModel(provider));
    const object = await getObject({ Key: storedImage.objectKey });

    if (!object.Body) {
      throw new Error('Storage returned an empty body');
    }

    const bodyBuffer = await readStorageBodyToBuffer(object.Body);
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
      prompt: BOWLING_EXTRACTION_PROMPT,
      model: providerModel
    });

    const completedAt = new Date();
    const durationMs = requestStartedAt ? completedAt.getTime() - requestStartedAt.getTime() : null;
    const rawTextForStorage = INCLUDE_LLM_RAW ? result.rawText : null;

    if (result.games.length === 0) {
      throw new Error('Provider returned no score games');
    }

    await prisma.lLMRequest.update({
      where: { id: llmRequestId },
      data: {
        completedAt,
        durationMs: durationMs ?? undefined,
        status: 'succeeded',
        model: result.model ?? providerModel,
        rawResponse: result.games as unknown as Prisma.InputJsonValue,
        rawText: rawTextForStorage
      }
    });

    await prisma.bowlingScore.deleteMany({
      where: { storedImageId: storedImage.id, isEstimate: true }
    });

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
