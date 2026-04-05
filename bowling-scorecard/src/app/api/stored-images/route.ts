import { NextResponse } from 'next/server';

import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { serializeStoredImage, storedImageInclude } from '@/server/serializers/storedImage';

const STORED_IMAGE_LIMIT = Number(process.env.STORED_IMAGE_LIMIT ?? '50');
const DEFAULT_PAGE_SIZE = Number.isNaN(STORED_IMAGE_LIMIT) ? 50 : Math.max(1, STORED_IMAGE_LIMIT);

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
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
    const { searchParams } = new URL(request.url);
    const requestedPage = Number.parseInt(searchParams.get('page') ?? '1', 10);
    const requestedPageSize = Number.parseInt(
      searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE),
      10
    );
    const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const pageSize =
      Number.isFinite(requestedPageSize) && requestedPageSize > 0
        ? requestedPageSize
        : DEFAULT_PAGE_SIZE;
    const skip = (page - 1) * pageSize;

    const totalImages = await prisma.storedImage.count({
      where: { userId: session.user.id }
    });

    const images = await prisma.storedImage.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: storedImageInclude
    });

    return NextResponse.json({
      success: true,
      page,
      pageSize,
      totalImages,
      totalPages: Math.max(1, Math.ceil(totalImages / pageSize)),
      images: images.map((image) => serializeStoredImage(image))
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load images' },
      { status: 500 }
    );
  }
}
