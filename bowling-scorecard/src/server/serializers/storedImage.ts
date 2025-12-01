import type { Prisma } from '@prisma/client';

export const storedImageInclude = {
  scores: {
    orderBy: [
      { gameIndex: 'asc' as const },
      { isEstimate: 'asc' as const },
      { updatedAt: 'desc' as const }
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
  },
  llmRequests: {
    where: {
      status: {
        in: ['queued', 'pending']
      }
    },
    select: {
      id: true,
      status: true
    }
  }
} satisfies Prisma.StoredImageInclude;

export type StoredImageWithRelations = Prisma.StoredImageGetPayload<{
  include: typeof storedImageInclude;
}>;

const selectLatestScores = (
  scores: StoredImageWithRelations['scores']
): StoredImageWithRelations['scores'] =>
  Object.values(
    scores.reduce<Record<number, (typeof scores)[number]>>((acc, score) => {
      const existing = acc[score.gameIndex];
      if (!existing || (existing.isEstimate && !score.isEstimate)) {
        acc[score.gameIndex] = score;
      }
      return acc;
    }, {})
  ).sort((a, b) => a.gameIndex - b.gameIndex);

export const serializeStoredImage = (image: StoredImageWithRelations) => {
  const latestScores = selectLatestScores(image.scores);
  const createdAt = image.createdAt.toISOString();
  const processing = Boolean(image.llmRequests && image.llmRequests.length > 0);

  return {
    id: image.id,
    bucket: image.bucket,
    objectKey: image.objectKey,
    originalFileName: image.originalFileName,
    contentType: image.contentType,
    sizeBytes: image.sizeBytes,
    createdAt,
    previewUrl: `/api/stored-images/${image.id}/content`,
    games: latestScores.map((score) => ({
      id: score.id,
      gameIndex: score.gameIndex,
      isEstimate: score.isEstimate,
      playerName: score.playerName,
      totalScore: score.totalScore,
      frames: score.frames,
      tenthFrame: score.tenthFrame
    })),
    isProcessingEstimate: processing
  };
};
