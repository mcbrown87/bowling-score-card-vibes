import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';

import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';

export const dynamic = 'force-dynamic';

const gameSchema = z.object({
  playerName: z.string().optional(),
  totalScore: z.number().nullable().optional(),
  frames: z.any(),
  tenthFrame: z.any(),
  issues: z.array(z.string()).optional(),
  confidence: z.number().nullable().optional()
});

type RouteContext = {
  params: {
    id: string;
    gameIndex: string;
  };
};

export async function PUT(request: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const storedImageId = context.params.id;
  const gameIndex = Number.parseInt(context.params.gameIndex, 10);

  if (!Number.isFinite(gameIndex) || gameIndex < 0) {
    return NextResponse.json({ success: false, error: 'Invalid game index' }, { status: 400 });
  }

  try {
    const storedImage = await prisma.storedImage.findUnique({
      where: { id: storedImageId },
      select: { id: true, userId: true }
    });

    if (!storedImage || storedImage.userId !== session.user.id) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = gameSchema.parse(body.game ?? body);

    const existing = await prisma.bowlingScore.findFirst({
      where: {
        storedImageId,
        gameIndex,
        isEstimate: false
      }
    });

    let correction;

    if (existing) {
      correction = await prisma.bowlingScore.update({
        where: { id: existing.id },
        data: {
          playerName: parsed.playerName ?? null,
          totalScore: parsed.totalScore ?? null,
          frames: parsed.frames as Prisma.InputJsonValue,
          tenthFrame: parsed.tenthFrame as Prisma.InputJsonValue,
          issues: (parsed.issues ?? null) as Prisma.InputJsonValue,
          confidence: parsed.confidence ?? null,
          provider: 'manual-correction'
        }
      });
    } else {
      correction = await prisma.bowlingScore.create({
        data: {
          storedImageId,
          gameIndex,
          playerName: parsed.playerName ?? null,
          totalScore: parsed.totalScore ?? null,
          frames: parsed.frames as Prisma.InputJsonValue,
          tenthFrame: parsed.tenthFrame as Prisma.InputJsonValue,
          issues: (parsed.issues ?? null) as Prisma.InputJsonValue,
          confidence: parsed.confidence ?? null,
          provider: 'manual-correction',
          isEstimate: false
        }
      });
    }

    return NextResponse.json({
      success: true,
      game: {
        id: correction.id,
        gameIndex: correction.gameIndex,
        isEstimate: correction.isEstimate,
        playerName: correction.playerName,
        totalScore: correction.totalScore,
        frames: correction.frames,
        tenthFrame: correction.tenthFrame,
        issues: correction.issues,
        confidence: correction.confidence
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to save correction' },
      { status: 500 }
    );
  }
}
