import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { BOWLING_EXTRACTION_PROMPT } from '@/server/prompts/bowling';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { uploadObject, getStorageBucket } from '@/server/storage/client';
import { logger } from '@/server/utils/logger';
import { dataUrlToBuffer, normalizeImageDataUrl } from '@/server/utils/image';
import { enqueueScoreEstimatorJob } from '@/server/queues/scoreEstimatorQueue';
import { serializeStoredImage, storedImageInclude } from '@/server/serializers/storedImage';
import {
  DEFAULT_PROVIDER,
  INCLUDE_LLM_RAW,
  PROVIDER_MODELS,
  PROMPT_VERSION
} from '@/server/services/scoreEstimator';

const requestSchema = z.object({
  imageDataUrl: z
    .string()
    .regex(/^data:.*;base64,/u, 'imageDataUrl must be a base64 data URL'),
  prompt: z.string().optional(),
  fileName: z.string().optional()
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const requestId = randomUUID();

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
    const provider: ProviderName = DEFAULT_PROVIDER;
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
        status: 'queued',
        rawRequest: rawRequestData
      }
    });

    try {
      await enqueueScoreEstimatorJob({
        storedImageId: storedImage.id,
        llmRequestId: llmRequest.id
      });
    } catch (error) {
      await prisma.lLMRequest.update({
        where: { id: llmRequest.id },
        data: {
          status: 'failed',
          errorMessage:
            error instanceof Error ? error.message : 'Unable to enqueue score estimation request'
        }
      });
      throw error;
    }

    const refreshedImage = await prisma.storedImage.findUnique({
      where: { id: storedImage.id },
      include: storedImageInclude
    });

    if (!refreshedImage) {
      throw new Error('Stored image not found after queuing extraction job');
    }

    logger.info('Queued bowling score extraction job', {
      provider,
      requestId,
      storedImageId: storedImage.id
    });

    return NextResponse.json(
      {
        success: true,
        queued: true,
        provider,
        requestId,
        storedImage: serializeStoredImage(refreshedImage)
      },
      { status: 202 }
    );
  } catch (error) {
    const statusCode = error instanceof z.ZodError ? 400 : 500;
    const message =
      error instanceof Error ? error.message : 'Failed to queue score extraction request';

    logger.error('Failed to queue bowling score extraction job', error, {
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
