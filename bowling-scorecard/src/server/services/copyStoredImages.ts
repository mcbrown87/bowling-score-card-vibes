import { Prisma } from '@prisma/client';

import { prisma } from '@/server/db/client';
import { copyObject } from '@/server/storage/client';
import { findOrCreatePlayerForName } from '@/server/services/players';

type CopyStoredImagesInput = {
  fromEmail: string;
  toEmail: string;
  imageIds: string[];
  execute: boolean;
};

export type CopyStoredImageResult =
  | {
      imageId: string;
      status: 'dry-run';
      destinationObjectKey: string;
      scoreCount: number;
    }
  | {
      imageId: string;
      status: 'copied';
      destinationImageId: string;
      destinationObjectKey: string;
      scoreCount: number;
    }
  | {
      imageId: string;
      status: 'skipped';
      reason: string;
      destinationImageId?: string;
      destinationObjectKey?: string;
    }
  | {
      imageId: string;
      status: 'failed';
      reason: string;
    };

type CopyStoredImagesSummary = {
  sourceUser: {
    id: string;
    email: string;
  };
  destinationUser: {
    id: string;
    email: string;
  };
  execute: boolean;
  results: CopyStoredImageResult[];
};

const sourceImageInclude = {
  scores: {
    orderBy: [
      { gameIndex: 'asc' as const },
      { isEstimate: 'desc' as const },
      { updatedAt: 'asc' as const }
    ],
    select: {
      gameIndex: true,
      playerName: true,
      totalScore: true,
      frames: true,
      tenthFrame: true,
      provider: true,
      isEstimate: true,
      rawText: true
    }
  }
} satisfies Prisma.StoredImageInclude;

type SourceImage = Prisma.StoredImageGetPayload<{
  include: typeof sourceImageInclude;
}>;

const extensionFromImage = (image: Pick<SourceImage, 'objectKey' | 'contentType'>) => {
  const keyExtension = image.objectKey.match(/(\.[a-z0-9]+)$/iu)?.[1];
  if (keyExtension) {
    return keyExtension.toLowerCase();
  }

  const contentType = image.contentType?.toLowerCase() ?? '';
  if (contentType.includes('png')) return '.png';
  if (contentType.includes('webp')) return '.webp';
  if (contentType.includes('gif')) return '.gif';
  return '.jpg';
};

const buildDestinationObjectKey = (targetUserId: string, image: SourceImage) =>
  `users/${targetUserId}/copies/${image.id}${extensionFromImage(image)}`;

const cloneScores = async (
  tx: Prisma.TransactionClient,
  destinationUserId: string,
  storedImageId: string,
  scores: SourceImage['scores']
) => {
  const clonedScores: Prisma.BowlingScoreCreateManyInput[] = [];

  for (const score of scores) {
    const player = await findOrCreatePlayerForName(tx, destinationUserId, score.playerName);

    clonedScores.push({
      storedImageId,
      playerId: player?.id ?? null,
      gameIndex: score.gameIndex,
      playerName: player?.name ?? score.playerName,
      totalScore: score.totalScore,
      frames: score.frames as Prisma.InputJsonValue,
      tenthFrame:
        score.tenthFrame === null ? Prisma.JsonNull : (score.tenthFrame as Prisma.InputJsonValue),
      provider: score.provider,
      isEstimate: score.isEstimate,
      rawText: score.rawText
    });
  }

  return clonedScores;
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown copy failure';

export async function copyStoredImagesToAccount({
  fromEmail,
  toEmail,
  imageIds,
  execute
}: CopyStoredImagesInput): Promise<CopyStoredImagesSummary> {
  const uniqueImageIds = Array.from(new Set(imageIds));

  if (uniqueImageIds.length === 0) {
    throw new Error('At least one image ID is required');
  }

  const [sourceUser, destinationUser] = await Promise.all([
    prisma.user.findUnique({
      where: { email: fromEmail },
      select: { id: true, email: true }
    }),
    prisma.user.findUnique({
      where: { email: toEmail },
      select: { id: true, email: true }
    })
  ]);

  if (!sourceUser) {
    throw new Error(`Source user not found: ${fromEmail}`);
  }

  if (!destinationUser) {
    throw new Error(`Destination user not found: ${toEmail}`);
  }

  const results: CopyStoredImageResult[] = [];

  for (const imageId of uniqueImageIds) {
    try {
      const sourceImage = await prisma.storedImage.findUnique({
        where: { id: imageId },
        include: sourceImageInclude
      });

      if (!sourceImage || sourceImage.userId !== sourceUser.id) {
        results.push({
          imageId,
          status: 'failed',
          reason: 'Source image was not found for the source user'
        });
        continue;
      }

      const destinationObjectKey = buildDestinationObjectKey(destinationUser.id, sourceImage);
      const existingCopy = await prisma.storedImage.findUnique({
        where: {
          bucket_objectKey: {
            bucket: sourceImage.bucket,
            objectKey: destinationObjectKey
          }
        },
        select: { id: true }
      });

      if (existingCopy) {
        results.push({
          imageId,
          status: 'skipped',
          reason: 'Destination copy already exists',
          destinationImageId: existingCopy.id,
          destinationObjectKey
        });
        continue;
      }

      if (!execute) {
        results.push({
          imageId,
          status: 'dry-run',
          destinationObjectKey,
          scoreCount: sourceImage.scores.length
        });
        continue;
      }

      await copyObject({
        SourceKey: sourceImage.objectKey,
        Key: destinationObjectKey,
        ContentType: sourceImage.contentType ?? undefined
      });

      const copiedImage = await prisma.$transaction(async (tx) => {
        const createdImage = await tx.storedImage.create({
          data: {
            userId: destinationUser.id,
            bucket: sourceImage.bucket,
            objectKey: destinationObjectKey,
            originalFileName: sourceImage.originalFileName,
            contentType: sourceImage.contentType,
            sizeBytes: sourceImage.sizeBytes
          }
        });

        const scoreData = await cloneScores(
          tx,
          destinationUser.id,
          createdImage.id,
          sourceImage.scores
        );
        if (scoreData.length > 0) {
          await tx.bowlingScore.createMany({
            data: scoreData
          });
        }

        return createdImage;
      });

      results.push({
        imageId,
        status: 'copied',
        destinationImageId: copiedImage.id,
        destinationObjectKey,
        scoreCount: sourceImage.scores.length
      });
    } catch (error) {
      results.push({
        imageId,
        status: 'failed',
        reason: errorMessage(error)
      });
    }
  }

  return {
    sourceUser,
    destinationUser,
    execute,
    results
  };
}
