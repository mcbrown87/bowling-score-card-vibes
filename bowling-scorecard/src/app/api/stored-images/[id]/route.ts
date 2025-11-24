import { NextResponse } from 'next/server';

import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { deleteObject } from '@/server/storage/client';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    id: string;
  };
};

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const storedImageId = context.params.id;

  try {
    const storedImage = await prisma.storedImage.findUnique({
      where: { id: storedImageId },
      select: {
        id: true,
        userId: true,
        bucket: true,
        objectKey: true
      }
    });

    if (!storedImage || storedImage.userId !== session.user.id) {
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
