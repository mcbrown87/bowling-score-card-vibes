import { NextResponse } from 'next/server';

import { BOWLING_EXTRACTION_PROMPT } from '@/server/prompts/bowling';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { enqueueScoreEstimatorJob } from '@/server/queues/scoreEstimatorQueue';
import { serializeStoredImage, storedImageInclude } from '@/server/serializers/storedImage';
import {
  DEFAULT_PROVIDER,
  PROVIDER_MODELS,
  PROMPT_VERSION
} from '@/server/services/scoreEstimator';

export const dynamic = 'force-dynamic';

const ACTIVE_STATUSES = ['queued', 'pending'];

type RouteContext = {
  params: {
    id: string;
  };
};

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

  try {
    const storedImage = await prisma.storedImage.findUnique({
      where: { id: storedImageId },
      include: storedImageInclude
    });

    if (!storedImage || storedImage.userId !== session.user.id) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const existingRequest = await prisma.lLMRequest.findFirst({
      where: {
        storedImageId: storedImage.id,
        status: {
          in: ACTIVE_STATUSES
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (existingRequest) {
      return NextResponse.json(
        {
          success: true,
          queued: true,
          requestId: existingRequest.id,
          storedImage: serializeStoredImage(storedImage)
        },
        { status: 202 }
      );
    }

    const provider = DEFAULT_PROVIDER;
    const providerModel = PROVIDER_MODELS[provider];
    const [promptRecord] = await prisma.$transaction([
      prisma.prompt.upsert({
        where: { version: PROMPT_VERSION },
        update: { content: BOWLING_EXTRACTION_PROMPT },
        create: { version: PROMPT_VERSION, content: BOWLING_EXTRACTION_PROMPT }
      })
    ]);

    const llmRequest = await prisma.lLMRequest.create({
      data: {
        storedImageId: storedImage.id,
        provider,
        model: providerModel,
        promptId: promptRecord.id,
        status: 'queued',
        rawRequest: {
          promptVersion: PROMPT_VERSION,
          providerModel,
          existingStoredImage: storedImage.id
        }
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

    return NextResponse.json(
      {
        success: true,
        queued: true,
        requestId: llmRequest.id,
        storedImage: serializeStoredImage(refreshedImage ?? storedImage)
      },
      { status: 202 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to queue score estimate';
    return NextResponse.json(
      {
        success: false,
        error: message
      },
      { status: 500 }
    );
  }
}
