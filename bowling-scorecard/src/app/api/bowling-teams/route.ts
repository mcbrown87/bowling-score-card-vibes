import { NextResponse } from 'next/server';

import { auth } from '@/server/auth';
import { getTenantAccessForSession } from '@/server/auth/tenant';
import { prisma } from '@/server/db/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tenantAccess = await getTenantAccessForSession(session);

    if (!tenantAccess) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const teams = await prisma.bowlingTeam.findMany({
      where: { tenantId: tenantAccess.tenantId },
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        name: true
      }
    });

    return NextResponse.json({
      success: true,
      teams
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load teams' },
      { status: 500 }
    );
  }
}
