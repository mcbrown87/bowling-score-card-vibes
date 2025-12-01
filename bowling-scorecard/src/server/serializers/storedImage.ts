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
    orderBy: { createdAt: 'desc' as const },
    take: 5,
    select: {
      id: true,
      status: true,
      errorMessage: true,
      createdAt: true,
      updatedAt: true
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
  const latestRequest = image.llmRequests[0];
  const activeRequest = image.llmRequests.find((req) =>
    ['queued', 'pending'].includes(req.status)
  );
  const lastEstimateError =
    latestRequest && latestRequest.status === 'failed' && latestRequest.errorMessage
      ? latestRequest.errorMessage
      : null;
  const processing = Boolean(activeRequest);

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
    isProcessingEstimate: processing,
    lastEstimateError
  };
};
