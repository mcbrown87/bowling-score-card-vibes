import { NextResponse } from 'next/server';

import { auth } from '@/server/auth';
import { getTenantAccessForSession } from '@/server/auth/tenant';
import { prisma } from '@/server/db/client';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    teamId: string;
  };
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tenantAccess = await getTenantAccessForSession(session);

    if (!tenantAccess) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const team = await prisma.bowlingTeam.findUnique({
      where: { id: context.params.teamId },
      select: { id: true, tenantId: true }
    });

    if (!team || team.tenantId !== tenantAccess.tenantId) {
      return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 });
    }

    const disabledStatuses = await prisma.teamRosterPlayerStatus.findMany({
      where: {
        teamId: team.id,
        isDisabled: true
      },
      select: {
        playerId: true
      }
    });

    return NextResponse.json({
      success: true,
      disabledPlayerIds: disabledStatuses.map((status) => status.playerId)
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load team roster status'
      },
      { status: 500 }
    );
  }
}
