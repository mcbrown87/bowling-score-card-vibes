import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/server/auth';
import { getTenantAccessForSession } from '@/server/auth/tenant';
import { prisma } from '@/server/db/client';
import { deleteObject } from '@/server/storage/client';
import { findOrCreateTeamForName } from '@/server/services/bowlingTeams';
import { serializeStoredImage, storedImageInclude } from '@/server/serializers/storedImage';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    id: string;
  };
};

const teamAssignmentSchema = z
  .object({
    teamId: z.string().nullable().optional(),
    teamName: z.string().optional()
  })
  .refine((value) => value.teamId !== undefined || value.teamName !== undefined, {
    message: 'A teamId or teamName is required'
  });

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const storedImageId = context.params.id;

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
      select: {
        id: true,
        tenantId: true
      }
    });

    if (!storedImage || storedImage.tenantId !== tenantAccess.tenantId) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const parsed = teamAssignmentSchema.parse(await request.json());

    let teamId: string | null = null;

    if (typeof parsed.teamId === 'string') {
      const team = await prisma.bowlingTeam.findUnique({
        where: { id: parsed.teamId },
        select: { id: true, tenantId: true }
      });

      if (!team || team.tenantId !== tenantAccess.tenantId) {
        return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 });
      }

      teamId = team.id;
    } else if (typeof parsed.teamName === 'string') {
      const team = await findOrCreateTeamForName(
        prisma,
        tenantAccess.tenantId,
        tenantAccess.userId,
        parsed.teamName
      );
      teamId = team?.id ?? null;
    }

    const updated = await prisma.storedImage.update({
      where: { id: storedImage.id },
      data: { teamId },
      include: storedImageInclude
    });

    return NextResponse.json({
      success: true,
      storedImage: serializeStoredImage(updated)
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
        error: error instanceof Error ? error.message : 'Failed to update image team'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const storedImageId = context.params.id;

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
      select: {
        id: true,
        tenantId: true,
        bucket: true,
        objectKey: true
      }
    });

    if (!storedImage || storedImage.tenantId !== tenantAccess.tenantId) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    // Delete the object from storage first; swallow 404 from storage
    if (storedImage.objectKey) {
      try {
        await deleteObject({ Key: storedImage.objectKey });
      } catch (error) {
        // Continue even if the object is already missing; we still remove DB rows
        console.warn('Failed to delete storage object', error);
      }
    }

    await prisma.storedImage.delete({
      where: { id: storedImage.id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to delete image' },
      { status: 500 }
    );
  }
}
