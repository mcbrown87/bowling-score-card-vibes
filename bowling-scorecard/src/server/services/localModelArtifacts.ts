import { createHash } from 'node:crypto';
import type { Game } from '@/types/bowling';

import { prisma } from '@/server/db/client';
import { updateRuntimeSettings } from '@/server/config/appConfig';
import { getObject } from '@/server/storage/client';
import { dataUrlToBuffer, normalizeImageDataUrl } from '@/server/utils/image';
import { readStorageBodyToBuffer } from '@/server/utils/storageBody';

type DatasetZipFile = {
  path: string;
  data: Buffer | string;
};

type DatasetZipEntry = {
  path: string;
  data: Buffer;
  crc32: number;
  localHeaderOffset: number;
};

const crcTable = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[index] = value >>> 0;
}

const crc32 = (buffer: Buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const writeUInt16 = (value: number) => {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
};

const writeUInt32 = (value: number) => {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
};

const buildStoredZip = (files: DatasetZipFile[]) => {
  const chunks: Buffer[] = [];
  const entries: DatasetZipEntry[] = [];
  let offset = 0;

  for (const file of files) {
    const pathBuffer = Buffer.from(file.path, 'utf-8');
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data, 'utf-8');
    const checksum = crc32(data);
    const localHeader = Buffer.concat([
      writeUInt32(0x04034b50),
      writeUInt16(20),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt32(checksum),
      writeUInt32(data.length),
      writeUInt32(data.length),
      writeUInt16(pathBuffer.length),
      writeUInt16(0),
      pathBuffer
    ]);

    chunks.push(localHeader, data);
    entries.push({
      path: file.path,
      data,
      crc32: checksum,
      localHeaderOffset: offset
    });
    offset += localHeader.length + data.length;
  }

  const centralDirectoryOffset = offset;
  for (const entry of entries) {
    const pathBuffer = Buffer.from(entry.path, 'utf-8');
    const centralHeader = Buffer.concat([
      writeUInt32(0x02014b50),
      writeUInt16(20),
      writeUInt16(20),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt32(entry.crc32),
      writeUInt32(entry.data.length),
      writeUInt32(entry.data.length),
      writeUInt16(pathBuffer.length),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt32(0),
      writeUInt32(entry.localHeaderOffset),
      pathBuffer
    ]);
    chunks.push(centralHeader);
    offset += centralHeader.length;
  }

  const centralDirectorySize = offset - centralDirectoryOffset;
  chunks.push(
    Buffer.concat([
      writeUInt32(0x06054b50),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(entries.length),
      writeUInt16(entries.length),
      writeUInt32(centralDirectorySize),
      writeUInt32(centralDirectoryOffset),
      writeUInt16(0)
    ])
  );

  return Buffer.concat(chunks);
};

export async function getTrainingDatasetCounts() {
  const correctedScores = await prisma.bowlingScore.findMany({
    where: { isEstimate: false },
    select: { storedImageId: true }
  });

  const uniqueImageIds = new Set(correctedScores.map((score) => score.storedImageId));

  return {
    datasetCorrectionCount: correctedScores.length,
    datasetImageCount: uniqueImageIds.size
  };
}

const frameToTrainingFrame = (
  frame: Game['frames'][number],
  frameNumber: number
): {
  frameNumber: number;
  rolls: Game['frames'][number]['rolls'];
  isStrike: boolean;
  isSpare: boolean;
  runningTotal: number;
} => ({
  frameNumber,
  rolls: frame.rolls,
  isStrike: frame.isStrike,
  isSpare: frame.isSpare,
  runningTotal: frame.score ?? 0
});

const gameToTrainingTarget = (game: Game) => ({
  playerName: game.playerName,
  totalScore: game.totalScore,
  frames: game.frames.map((frame, index) => frameToTrainingFrame(frame, index + 1)),
  tenthFrame: frameToTrainingFrame(game.tenthFrame, 10)
});

const emptyTenthFrame: Game['tenthFrame'] = {
  rolls: [],
  isStrike: false,
  isSpare: false,
  score: 0
};

export async function buildValidatedScoreDatasetExport() {
  const correctedImages = await prisma.storedImage.findMany({
    where: {
      scores: {
        some: {
          isEstimate: false
        }
      }
    },
    select: {
      id: true,
      objectKey: true,
      contentType: true,
      originalFileName: true,
      createdAt: true,
      scores: {
        where: { isEstimate: false },
        orderBy: { gameIndex: 'asc' },
        select: {
          id: true,
          gameIndex: true,
          playerName: true,
          totalScore: true,
          frames: true,
          tenthFrame: true,
          provider: true,
          createdAt: true,
          updatedAt: true
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  const examples = [];

  for (const image of correctedImages) {
    const object = await getObject({ Key: image.objectKey });
    const bodyBuffer = await readStorageBodyToBuffer(object.Body);
    const mediaType = image.contentType ?? 'image/jpeg';
    const normalizedImage = await normalizeImageDataUrl(
      `data:${mediaType};base64,${bodyBuffer.toString('base64')}`
    );
    const { buffer, mediaType: normalizedMediaType } = dataUrlToBuffer(normalizedImage.dataUrl);
    const games: Game[] = image.scores.map((score) => ({
      playerName: score.playerName ?? `Player ${score.gameIndex + 1}`,
      totalScore: score.totalScore ?? 0,
      frames: Array.isArray(score.frames) ? (score.frames as unknown as Game['frames']) : [],
      tenthFrame:
        score.tenthFrame && typeof score.tenthFrame === 'object'
          ? (score.tenthFrame as unknown as Game['tenthFrame'])
          : emptyTenthFrame
    }));
    const target = {
      success: true,
      failureReason: null,
      players: games.map(gameToTrainingTarget)
    };

    examples.push({
      storedImageId: image.id,
      originalFileName: image.originalFileName,
      contentType: normalizedMediaType,
      createdAt: image.createdAt.toISOString(),
      imageSha256: createHash('sha256').update(buffer).digest('hex'),
      imageDataUrl: normalizedImage.dataUrl,
      target,
      targetText: JSON.stringify(target),
      games,
      corrections: image.scores.map((score) => ({
        id: score.id,
        gameIndex: score.gameIndex,
        provider: score.provider,
        createdAt: score.createdAt.toISOString(),
        updatedAt: score.updatedAt.toISOString()
      }))
    });
  }

  const correctionCount = examples.reduce((sum, example) => sum + example.games.length, 0);

  return {
    schemaVersion: 'bowling-scorecard-training-dataset-v1',
    exportedAt: new Date().toISOString(),
    imageCount: examples.length,
    correctionCount,
    examples
  };
}

export async function buildValidatedScoreDatasetZipExport() {
  const dataset = await buildValidatedScoreDatasetExport();
  const files: DatasetZipFile[] = [];
  const metadataRows: string[] = [];
  const manifestExamples = dataset.examples.map((example) => {
    const { buffer, mediaType } = dataUrlToBuffer(example.imageDataUrl);
    const extension = mediaType.includes('png') ? 'png' : mediaType.includes('webp') ? 'webp' : 'jpg';
    const imagePath = `images/${example.imageSha256}.${extension}`;
    const labelPath = `labels/${example.imageSha256}.json`;

    files.push({ path: imagePath, data: buffer });
    files.push({ path: labelPath, data: JSON.stringify(example.target, null, 2) });
    metadataRows.push(
      JSON.stringify({
        file_name: imagePath,
        ground_truth_path: labelPath,
        ground_truth: example.targetText,
        storedImageId: example.storedImageId,
        imageSha256: example.imageSha256,
        originalFileName: example.originalFileName
      })
    );

    return {
      storedImageId: example.storedImageId,
      originalFileName: example.originalFileName,
      contentType: mediaType,
      createdAt: example.createdAt,
      imageSha256: example.imageSha256,
      imagePath,
      labelPath,
      games: example.games,
      corrections: example.corrections
    };
  });

  const manifest = {
    schemaVersion: 'bowling-scorecard-training-dataset-zip-v1',
    exportedAt: dataset.exportedAt,
    imageCount: dataset.imageCount,
    correctionCount: dataset.correctionCount,
    examples: manifestExamples
  };

  files.unshift({ path: 'manifest.json', data: JSON.stringify(manifest, null, 2) });
  files.push({
    path: 'examples.jsonl',
    data: `${metadataRows.join('\n')}\n`
  });

  return buildStoredZip(files);
}

export async function activateModelArtifact(artifactId: string) {
  const artifact = await prisma.modelArtifact.findUnique({
    where: { id: artifactId }
  });

  if (!artifact) {
    throw new Error('Model artifact not found');
  }

  await prisma.$transaction([
    prisma.modelArtifact.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    }),
    prisma.modelArtifact.update({
      where: { id: artifactId },
      data: {
        isActive: true,
        activatedAt: new Date()
      }
    })
  ]);

  await updateRuntimeSettings({
    activeProvider: 'local',
    localModelArtifactId: artifact.id,
    localModelName: artifact.version
  });

  return artifact;
}
