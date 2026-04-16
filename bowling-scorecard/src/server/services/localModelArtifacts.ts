import { createHash } from 'node:crypto';
import type { Game } from '@/types/bowling';

import { prisma } from '@/server/db/client';
import { updateRuntimeSettings } from '@/server/config/appConfig';
import { getObject } from '@/server/storage/client';
import { dataUrlToBuffer, normalizeImageDataUrl } from '@/server/utils/image';
import { readStorageBodyToBuffer } from '@/server/utils/storageBody';

type DatasetZipStreamFile = {
  path: string;
  data: AsyncIterable<Buffer | string> | Buffer | string;
};

type DatasetZipEntry = {
  path: string;
  crc32: number;
  size: number;
  localHeaderOffset: number;
};

type DatasetZipManifestExample = {
  storedImageId: string;
  originalFileName: string | null;
  contentType: string;
  createdAt: string;
  imageSha256: string;
  imagePath: string;
  labelPath: string;
  games: Game[];
  corrections: Array<{
    id: string;
    gameIndex: number;
    provider: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

const crcTable = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[index] = value >>> 0;
}

const updateCrc32 = (crc: number, buffer: Buffer) => {
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return crc;
};

const finalizeCrc32 = (crc: number) => (crc ^ 0xffffffff) >>> 0;

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

async function* toZipDataChunks(
  data: DatasetZipStreamFile['data']
): AsyncGenerator<Buffer, void, undefined> {
  if (typeof data === 'string') {
    yield Buffer.from(data, 'utf-8');
    return;
  }

  if (Buffer.isBuffer(data)) {
    yield data;
    return;
  }

  for await (const chunk of data) {
    yield typeof chunk === 'string' ? Buffer.from(chunk, 'utf-8') : chunk;
  }
}

async function* buildStoredZipStream(
  files: AsyncIterable<DatasetZipStreamFile>
): AsyncGenerator<Buffer, void, undefined> {
  const entries: DatasetZipEntry[] = [];
  let offset = 0;

  for await (const file of files) {
    const pathBuffer = Buffer.from(file.path, 'utf-8');
    const localHeaderOffset = offset;
    const localHeader = Buffer.concat([
      writeUInt32(0x04034b50),
      writeUInt16(20),
      writeUInt16(0x08),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt32(0),
      writeUInt32(0),
      writeUInt32(0),
      writeUInt16(pathBuffer.length),
      writeUInt16(0),
      pathBuffer
    ]);

    yield localHeader;
    offset += localHeader.length;

    let checksum = 0xffffffff;
    let size = 0;

    for await (const chunk of toZipDataChunks(file.data)) {
      checksum = updateCrc32(checksum, chunk);
      size += chunk.length;
      yield chunk;
      offset += chunk.length;
    }

    const finalizedChecksum = finalizeCrc32(checksum);
    const dataDescriptor = Buffer.concat([
      writeUInt32(0x08074b50),
      writeUInt32(finalizedChecksum),
      writeUInt32(size),
      writeUInt32(size)
    ]);

    yield dataDescriptor;
    offset += dataDescriptor.length;

    entries.push({
      path: file.path,
      crc32: finalizedChecksum,
      size,
      localHeaderOffset
    });
  }

  const centralDirectoryOffset = offset;
  for (const entry of entries) {
    const pathBuffer = Buffer.from(entry.path, 'utf-8');
    const centralHeader = Buffer.concat([
      writeUInt32(0x02014b50),
      writeUInt16(20),
      writeUInt16(20),
      writeUInt16(0x08),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt32(entry.crc32),
      writeUInt32(entry.size),
      writeUInt32(entry.size),
      writeUInt16(pathBuffer.length),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt32(0),
      writeUInt32(entry.localHeaderOffset),
      pathBuffer
    ]);

    yield centralHeader;
    offset += centralHeader.length;
  }

  const centralDirectorySize = offset - centralDirectoryOffset;
  yield Buffer.concat([
    writeUInt32(0x06054b50),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(entries.length),
    writeUInt16(entries.length),
    writeUInt32(centralDirectorySize),
    writeUInt32(centralDirectoryOffset),
    writeUInt16(0)
  ]);
}

const asyncIterableToReadableStream = (chunks: AsyncIterable<Buffer>) => {
  const iterator = chunks[Symbol.asyncIterator]();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await iterator.next();

      if (done) {
        controller.close();
        return;
      }

      controller.enqueue(value);
    },
    async cancel() {
      await iterator.return?.();
    }
  });
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
  const chunks: Buffer[] = [];

  for await (const chunk of buildValidatedScoreDatasetZipExportChunks()) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

async function* buildValidatedScoreDatasetZipExportFiles(): AsyncGenerator<
  DatasetZipStreamFile,
  void,
  undefined
> {
  const exportedAt = new Date().toISOString();
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

  const metadataRows: string[] = [];
  const manifestExamples: DatasetZipManifestExample[] = [];
  let correctionCount = 0;

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
    const imageSha256 = createHash('sha256').update(buffer).digest('hex');
    const extension = normalizedMediaType.includes('png')
      ? 'png'
      : normalizedMediaType.includes('webp')
        ? 'webp'
        : 'jpg';
    const imagePath = `images/${imageSha256}.${extension}`;
    const labelPath = `labels/${imageSha256}.json`;

    yield { path: imagePath, data: buffer };
    yield { path: labelPath, data: JSON.stringify(target, null, 2) };
    metadataRows.push(
      JSON.stringify({
        file_name: imagePath,
        ground_truth_path: labelPath,
        ground_truth: JSON.stringify(target),
        storedImageId: image.id,
        imageSha256,
        originalFileName: image.originalFileName
      })
    );

    manifestExamples.push({
      storedImageId: image.id,
      originalFileName: image.originalFileName,
      contentType: normalizedMediaType,
      createdAt: image.createdAt.toISOString(),
      imageSha256,
      imagePath,
      labelPath,
      games,
      corrections: image.scores.map((score) => ({
        id: score.id,
        gameIndex: score.gameIndex,
        provider: score.provider,
        createdAt: score.createdAt.toISOString(),
        updatedAt: score.updatedAt.toISOString()
      }))
    });
    correctionCount += games.length;
  }

  const manifest = {
    schemaVersion: 'bowling-scorecard-training-dataset-zip-v1',
    exportedAt,
    imageCount: manifestExamples.length,
    correctionCount,
    examples: manifestExamples
  };

  yield { path: 'manifest.json', data: JSON.stringify(manifest, null, 2) };
  yield {
    path: 'examples.jsonl',
    data: `${metadataRows.join('\n')}\n`
  };
}

export function buildValidatedScoreDatasetZipExportChunks() {
  return buildStoredZipStream(buildValidatedScoreDatasetZipExportFiles());
}

export function buildValidatedScoreDatasetZipExportStream() {
  return asyncIterableToReadableStream(buildValidatedScoreDatasetZipExportChunks());
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
