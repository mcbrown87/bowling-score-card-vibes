import { NextResponse } from 'next/server';

import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';

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
      include: {
        scores: {
          orderBy: { gameIndex: 'asc' },
          select: {
            id: true,
            playerName: true,
            totalScore: true,
            frames: true,
            tenthFrame: true,
            issues: true,
            confidence: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      images: images.map((image) => ({
        id: image.id,
        objectKey: image.objectKey,
        bucket: image.bucket,
        originalFileName: image.originalFileName,
        contentType: image.contentType,
        sizeBytes: image.sizeBytes,
        createdAt: image.createdAt.toISOString(),
        previewUrl: `/api/stored-images/${image.id}/content`,
        games: image.scores.map((score) => ({
          id: score.id,
          playerName: score.playerName,
          totalScore: score.totalScore,
          frames: score.frames,
          tenthFrame: score.tenthFrame,
          issues: score.issues,
          confidence: score.confidence
        }))
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load images' },
      { status: 500 }
    );
  }
}
