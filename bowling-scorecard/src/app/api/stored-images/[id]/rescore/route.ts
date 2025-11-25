import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

import { BOWLING_EXTRACTION_PROMPT } from '@/server/prompts/bowling';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { runProvider } from '@/server/providers';
import type { ProviderName } from '@/server/providers/types';
import { getObject } from '@/server/storage/client';
import { normalizeImageDataUrl } from '@/server/utils/image';
import { logger } from '@/server/utils/logger';

const DEFAULT_PROVIDER: ProviderName = (process.env.DEFAULT_PROVIDER as ProviderName) ?? 'openai';
const INCLUDE_LLM_RAW = process.env.INCLUDE_LLM_RAW === 'true';
const PROVIDER_MODELS: Record<ProviderName, string> = {
  anthropic: process.env.ANTHROPIC_MODEL ?? 'claude-3-7-sonnet-latest',
  openai: process.env.OPENAI_MODEL ?? 'gpt-4o'
};
const PROMPT_VERSION = process.env.BOWLING_PROMPT_VERSION ?? 'bowling-v1';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    id: string;
  };
};

async function readBodyToBuffer(body: unknown): Promise<Buffer> {
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
}

export async function POST(_request: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      {
        status: 401
      }
    );
  }

  const storedImageId = context.params.id;
  let llmRequestId: string | null = null;
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

    if (!storedImage || storedImage.userId !== session.user.id) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const object = await getObject({ Key: storedImage.objectKey });

    if (!object.Body) {
      throw new Error('Storage returned an empty body');
    }

    const bodyBuffer = await readBodyToBuffer(object.Body);
    const mediaType = storedImage.contentType ?? 'image/jpeg';
    const dataUrl = `data:${mediaType};base64,${bodyBuffer.toString('base64')}`;
    const normalizedImage = await normalizeImageDataUrl(dataUrl);

    const provider = DEFAULT_PROVIDER;
    const providerModel = PROVIDER_MODELS[provider];
    const requestPrompt = BOWLING_EXTRACTION_PROMPT;

    const rawRequestData: Prisma.JsonObject = {
      prompt: requestPrompt,
      providerModel,
      existingStoredImage: storedImage.id,
      convertedImage: normalizedImage.converted
    };

    const [promptRecord] = await prisma.$transaction([
      prisma.prompt.upsert({
        where: { version: PROMPT_VERSION },
        update: { content: requestPrompt },
        create: { version: PROMPT_VERSION, content: requestPrompt }
      })
    ]);

    requestStartedAt = new Date();
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

    const completedAt = new Date();
    const durationMs =
      requestStartedAt !== null ? completedAt.getTime() - requestStartedAt.getTime() : null;
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
          issues: (game.issues ?? null) as unknown as Prisma.InputJsonValue,
          confidence: game.confidence ?? null,
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

    return NextResponse.json({
      success: true,
      games: result.games,
      storedImage: {
        id: storedImage.id,
        bucket: storedImage.bucket,
        objectKey: storedImage.objectKey,
        originalFileName: storedImage.originalFileName,
        contentType: storedImage.contentType,
        sizeBytes: storedImage.sizeBytes,
        createdAt: storedImage.createdAt.toISOString(),
        games: result.games
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate score estimate';

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

    logger.error('Failed to regenerate bowling scores', error, {
      storedImageId,
      llmRequestId
    });

    return NextResponse.json(
      {
        success: false,
        error: message
      },
      { status: 500 }
    );
  }
}
