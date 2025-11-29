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
          orderBy: [
            { gameIndex: 'asc' },
            { isEstimate: 'asc' },
            { updatedAt: 'desc' }
          ],
          select: {
            id: true,
            gameIndex: true,
            isEstimate: true,
            playerName: true,
            totalScore: true,
            frames: true,
            tenthFrame: true,
            createdAt: true,
            updatedAt: true
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
        games: Object.values(
          image.scores.reduce<Record<number, (typeof image.scores)[number]>>((acc, score) => {
            const existing = acc[score.gameIndex];
            if (!existing || (existing.isEstimate && !score.isEstimate)) {
              acc[score.gameIndex] = score;
            }
            return acc;
          }, {})
        )
          .sort((a, b) => a.gameIndex - b.gameIndex)
          .map((score) => ({
            id: score.id,
            gameIndex: score.gameIndex,
            isEstimate: score.isEstimate,
            playerName: score.playerName,
            totalScore: score.totalScore,
            frames: score.frames,
            tenthFrame: score.tenthFrame
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
