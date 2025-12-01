import { NextResponse } from 'next/server';

import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { serializeStoredImage, storedImageInclude } from '@/server/serializers/storedImage';

const STORED_IMAGE_LIMIT = Number(process.env.STORED_IMAGE_LIMIT ?? '50');

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      {
        status: 401
      }
    );
  }

  try {
    const images = await prisma.storedImage.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: Number.isNaN(STORED_IMAGE_LIMIT) ? 50 : STORED_IMAGE_LIMIT,
      include: storedImageInclude
    });

    return NextResponse.json({
      success: true,
      images: images.map((image) => serializeStoredImage(image))
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load images' },
      { status: 500 }
    );
  }
}
