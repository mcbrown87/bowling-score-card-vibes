import { NextResponse } from 'next/server';

import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    id: string;
  };
};

// Remove all score estimates for a stored image
export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const storedImageId = context.params.id;

  try {
    const storedImage = await prisma.storedImage.findUnique({
      where: { id: storedImageId },
      select: { id: true, userId: true }
    });

    if (!storedImage || storedImage.userId !== session.user.id) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const deleted = await prisma.bowlingScore.deleteMany({
      where: { storedImageId }
    });

    return NextResponse.json({
      success: true,
      deleted: deleted.count
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to clear scores' },
      { status: 500 }
    );
  }
}
