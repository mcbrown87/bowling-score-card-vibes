import { createHash } from 'node:crypto';

const bowlingScoreFindMany = jest.fn();
const storedImageFindMany = jest.fn();
const modelArtifactFindUnique = jest.fn();
const modelArtifactUpdateMany = jest.fn();
const modelArtifactUpdate = jest.fn();
const transaction = jest.fn();
const updateRuntimeSettings = jest.fn();
const getObject = jest.fn();

jest.mock('@/server/db/client', () => ({
  prisma: {
    bowlingScore: {
      findMany: bowlingScoreFindMany
    },
    storedImage: {
      findMany: storedImageFindMany
    },
    modelArtifact: {
      findUnique: modelArtifactFindUnique,
      updateMany: modelArtifactUpdateMany,
      update: modelArtifactUpdate
    },
    $transaction: transaction
  }
}));

jest.mock('@/server/config/appConfig', () => ({
  updateRuntimeSettings
}));

jest.mock('@/server/storage/client', () => ({
  getObject
}));

jest.mock('@/server/utils/image', () => ({
  dataUrlToBuffer: (dataUrl: string) => {
    const [header, payload] = dataUrl.split(',', 2);
    const mediaType = header.replace('data:', '').replace(';base64', '') || 'image/jpeg';
    return {
      buffer: Buffer.from(payload, 'base64'),
      mediaType
    };
  },
  normalizeImageDataUrl: async (dataUrl: string) => ({
    dataUrl,
    mediaType: dataUrl.slice(5, dataUrl.indexOf(';base64'))
  })
}));

describe('localModelArtifacts service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('counts corrected training examples by unique image and correction count', async () => {
    bowlingScoreFindMany.mockResolvedValue([
      { storedImageId: 'image-1' },
      { storedImageId: 'image-1' },
      { storedImageId: 'image-2' }
    ]);

    const { getTrainingDatasetCounts } = await import('@/server/services/localModelArtifacts');

    await expect(getTrainingDatasetCounts()).resolves.toEqual({
      datasetCorrectionCount: 3,
      datasetImageCount: 2
    });
    expect(bowlingScoreFindMany).toHaveBeenCalledWith({
      where: { isEstimate: false },
      select: { storedImageId: true }
    });
  });

  it('exports corrected scores as a stored ZIP dataset', async () => {
    const imageBytes = Buffer.from('scorecard-image');
    const imageSha256 = createHash('sha256').update(imageBytes).digest('hex');
    storedImageFindMany.mockResolvedValue([
      {
        id: 'image-1',
        objectKey: 'uploads/image-1.jpg',
        contentType: 'image/jpeg',
        originalFileName: 'league.jpg',
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        scores: [
          {
            id: 'score-1',
            gameIndex: 0,
            playerName: 'Alex',
            totalScore: 123,
            frames: [
              {
                rolls: [{ pins: 5 }, { pins: 4 }],
                isStrike: false,
                isSpare: false,
                score: 9
              }
            ],
            tenthFrame: {
              rolls: [{ pins: 7 }, { pins: 2 }],
              isStrike: false,
              isSpare: false,
              score: 123
            },
            provider: 'openai',
            createdAt: new Date('2026-04-01T01:00:00.000Z'),
            updatedAt: new Date('2026-04-01T02:00:00.000Z')
          }
        ]
      }
    ]);
    getObject.mockResolvedValue({ Body: imageBytes });

    const { buildValidatedScoreDatasetZipExport } = await import(
      '@/server/services/localModelArtifacts'
    );
    const zip = await buildValidatedScoreDatasetZipExport();
    const zipText = zip.toString('latin1');

    expect(Buffer.isBuffer(zip)).toBe(true);
    expect(zipText).toContain('manifest.json');
    expect(zipText).toContain('examples.jsonl');
    expect(zipText).toContain(`images/${imageSha256}.jpg`);
    expect(zipText).toContain(`labels/${imageSha256}.json`);
    expect(zipText).toContain('bowling-scorecard-training-dataset-zip-v1');
    expect(zipText).toContain('Alex');
    expect(getObject).toHaveBeenCalledWith({ Key: 'uploads/image-1.jpg' });
  });

  it('activates one model artifact and switches runtime settings to local', async () => {
    const artifact = {
      id: 'artifact-1',
      version: 'v1'
    };
    modelArtifactFindUnique.mockResolvedValue(artifact);
    modelArtifactUpdateMany.mockReturnValue('deactivate-active');
    modelArtifactUpdate.mockReturnValue('activate-requested');
    transaction.mockResolvedValue(undefined);

    const { activateModelArtifact } = await import('@/server/services/localModelArtifacts');
    await expect(activateModelArtifact('artifact-1')).resolves.toBe(artifact);

    expect(modelArtifactUpdateMany).toHaveBeenCalledWith({
      where: { isActive: true },
      data: { isActive: false }
    });
    expect(modelArtifactUpdate).toHaveBeenCalledWith({
      where: { id: 'artifact-1' },
      data: {
        isActive: true,
        activatedAt: expect.any(Date)
      }
    });
    expect(transaction).toHaveBeenCalledWith(['deactivate-active', 'activate-requested']);
    expect(updateRuntimeSettings).toHaveBeenCalledWith({
      activeProvider: 'local',
      localModelArtifactId: 'artifact-1',
      localModelName: 'v1'
    });
  });

  it('throws when activating a missing artifact', async () => {
    modelArtifactFindUnique.mockResolvedValue(null);

    const { activateModelArtifact } = await import('@/server/services/localModelArtifacts');

    await expect(activateModelArtifact('missing')).rejects.toThrow('Model artifact not found');
    expect(transaction).not.toHaveBeenCalled();
    expect(updateRuntimeSettings).not.toHaveBeenCalled();
  });
});
