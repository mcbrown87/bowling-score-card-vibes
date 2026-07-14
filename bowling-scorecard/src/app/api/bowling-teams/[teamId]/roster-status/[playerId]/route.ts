import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';

export const dynamic = 'force-dynamic';

const rosterStatusSchema = z.object({
  isDisabled: z.boolean()
});

type RouteContext = {
  params: {
    teamId: string;
    playerId: string;
  };
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const parsed = rosterStatusSchema.parse(await request.json());

    const [team, player] = await Promise.all([
      prisma.bowlingTeam.findUnique({
        where: { id: context.params.teamId },
        select: { id: true, userId: true }
      }),
      prisma.player.findUnique({
        where: { id: context.params.playerId },
        select: { id: true, userId: true }
      })
    ]);

    if (!team || team.userId !== session.user.id) {
      return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 });
    }

    if (!player || player.userId !== session.user.id) {
      return NextResponse.json({ success: false, error: 'Player not found' }, { status: 404 });
    }

    const rosterStatus = await prisma.teamRosterPlayerStatus.upsert({
      where: {
        teamId_playerId: {
          teamId: team.id,
          playerId: player.id
        }
      },
      update: {
        isDisabled: parsed.isDisabled
      },
      create: {
        teamId: team.id,
        playerId: player.id,
        isDisabled: parsed.isDisabled
      },
      select: {
        teamId: true,
        playerId: true,
        isDisabled: true
      }
    });

    return NextResponse.json({
      success: true,
      rosterStatus
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors.map((issue) => issue.message).join('; ') },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save team roster status'
      },
      { status: 500 }
    );
  }
}
