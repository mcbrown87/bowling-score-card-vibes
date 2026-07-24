import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';

import { auth } from '@/server/auth';
import { getTenantAccessForSession } from '@/server/auth/tenant';
import { prisma } from '@/server/db/client';
import { findOrCreatePlayerForName } from '@/server/services/players';

export const dynamic = 'force-dynamic';

const gameSchema = z.object({
  playerName: z.string().optional(),
  totalScore: z.number().nullable().optional(),
  frames: z.any(),
  tenthFrame: z.any()
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
    const tenantAccess = await getTenantAccessForSession(session);

    if (!tenantAccess) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!tenantAccess.canEdit) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const storedImage = await prisma.storedImage.findUnique({
      where: { id: storedImageId },
      select: { id: true, tenantId: true }
    });

    if (!storedImage || storedImage.tenantId !== tenantAccess.tenantId) {
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

    const correction = await prisma.$transaction(async (tx) => {
      const player = await findOrCreatePlayerForName(
        tx,
        tenantAccess.tenantId,
        tenantAccess.userId,
        parsed.playerName
      );
      const data = {
        playerId: player?.id ?? null,
        playerName: player?.name ?? parsed.playerName ?? null,
        totalScore: parsed.totalScore ?? null,
        frames: parsed.frames as Prisma.InputJsonValue,
        tenthFrame: parsed.tenthFrame as Prisma.InputJsonValue,
        provider: 'manual-correction'
      };

      if (existing) {
        return tx.bowlingScore.update({
          where: { id: existing.id },
          data,
          include: {
            player: {
              select: {
                id: true,
                name: true
              }
            }
          }
        });
      }

      return tx.bowlingScore.create({
        data: {
          storedImageId,
          gameIndex,
          ...data,
          isEstimate: false
        },
        include: {
          player: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });
    });

    return NextResponse.json({
      success: true,
      game: {
        id: correction.id,
        gameIndex: correction.gameIndex,
        isEstimate: correction.isEstimate,
        player: correction.player,
        playerName: correction.playerName,
        totalScore: correction.totalScore,
        frames: correction.frames,
        tenthFrame: correction.tenthFrame
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to save correction' },
      { status: 500 }
    );
  }
}
