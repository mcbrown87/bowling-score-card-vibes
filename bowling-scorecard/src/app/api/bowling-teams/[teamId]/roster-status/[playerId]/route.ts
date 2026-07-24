import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/server/auth';
import { getTenantAccessForSession } from '@/server/auth/tenant';
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
    const tenantAccess = await getTenantAccessForSession(session);

    if (!tenantAccess) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!tenantAccess.canEdit) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const parsed = rosterStatusSchema.parse(await request.json());

    const [team, player] = await Promise.all([
      prisma.bowlingTeam.findUnique({
        where: { id: context.params.teamId },
        select: { id: true, tenantId: true }
      }),
      prisma.player.findUnique({
        where: { id: context.params.playerId },
        select: { id: true, tenantId: true }
      })
    ]);

    if (!team || team.tenantId !== tenantAccess.tenantId) {
      return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 });
    }

    if (!player || player.tenantId !== tenantAccess.tenantId) {
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
