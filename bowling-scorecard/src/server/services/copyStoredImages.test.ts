const userFindUnique = jest.fn();
const storedImageFindUnique = jest.fn();
const storedImageCreate = jest.fn();
const bowlingScoreCreateMany = jest.fn();
const playerUpsert = jest.fn();
const tenantMembershipFindFirst = jest.fn();
const userUpdateMany = jest.fn();
const transaction = jest.fn();
const copyObject = jest.fn();

jest.mock('@/server/db/client', () => ({
  prisma: {
    user: {
      findUnique: userFindUnique,
      updateMany: userUpdateMany
    },
    tenantMembership: {
      findFirst: tenantMembershipFindFirst
    },
    storedImage: {
      findUnique: storedImageFindUnique,
      create: storedImageCreate
    },
    bowlingScore: {
      createMany: bowlingScoreCreateMany
    },
    $transaction: transaction
  }
}));

jest.mock('@/server/storage/client', () => ({
  copyObject
}));

const sourceImage = {
  id: 'image-1',
  userId: 'source-user',
  bucket: 'scorecards',
  objectKey: 'users/source-user/upload-1.jpg',
  originalFileName: 'league-night.jpg',
  contentType: 'image/jpeg',
  sizeBytes: 12345,
  scores: [
    {
      gameIndex: 0,
      playerName: 'M C Brown',
      totalScore: 211,
      frames: [{ score: 20 }],
      tenthFrame: { score: 21 },
      provider: 'openai',
      isEstimate: true,
      rawText: 'raw estimate'
    },
    {
      gameIndex: 0,
      playerName: 'M C Brown',
      totalScore: 214,
      frames: [{ score: 22 }],
      tenthFrame: { score: 24 },
      provider: 'manual',
      isEstimate: false,
      rawText: null
    }
  ]
};

describe('copyStoredImagesToAccount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    userFindUnique.mockImplementation(({ where }: { where: { email: string } }) => {
      if (where.email === 'source@example.com') {
        return Promise.resolve({ id: 'source-user', email: where.email, name: null });
      }
      if (where.email === 'target@example.com') {
        return Promise.resolve({ id: 'target-user', email: where.email, name: null });
      }
      return Promise.resolve(null);
    });
    tenantMembershipFindFirst.mockResolvedValue({ tenantId: 'target-tenant' });
    userUpdateMany.mockResolvedValue({ count: 0 });
    transaction.mockImplementation(async (callback) =>
      callback({
        storedImage: {
          create: storedImageCreate
        },
        bowlingScore: {
          createMany: bowlingScoreCreateMany
        },
        player: {
          upsert: playerUpsert
        }
      })
    );
    storedImageCreate.mockResolvedValue({ id: 'copied-image-1' });
    bowlingScoreCreateMany.mockResolvedValue({ count: 2 });
    playerUpsert.mockResolvedValue({ id: 'target-player-1', name: 'M C Brown' });
  });

  it('reports selected images without mutating storage or database during dry runs', async () => {
    storedImageFindUnique.mockResolvedValueOnce(sourceImage).mockResolvedValueOnce(null);

    const { copyStoredImagesToAccount } = await import('./copyStoredImages');
    const result = await copyStoredImagesToAccount({
      fromEmail: 'source@example.com',
      toEmail: 'target@example.com',
      imageIds: ['image-1'],
      execute: false
    });

    expect(result.results).toEqual([
      {
        imageId: 'image-1',
        status: 'dry-run',
        destinationObjectKey: 'users/target-user/copies/image-1.jpg',
        scoreCount: 2
      }
    ]);
    expect(copyObject).not.toHaveBeenCalled();
    expect(storedImageCreate).not.toHaveBeenCalled();
    expect(bowlingScoreCreateMany).not.toHaveBeenCalled();
  });

  it('copies storage object and clones scores when execution is enabled', async () => {
    storedImageFindUnique.mockResolvedValueOnce(sourceImage).mockResolvedValueOnce(null);

    const { copyStoredImagesToAccount } = await import('./copyStoredImages');
    const result = await copyStoredImagesToAccount({
      fromEmail: 'source@example.com',
      toEmail: 'target@example.com',
      imageIds: ['image-1'],
      execute: true
    });

    expect(copyObject).toHaveBeenCalledWith({
      SourceKey: 'users/source-user/upload-1.jpg',
      Key: 'users/target-user/copies/image-1.jpg',
      ContentType: 'image/jpeg'
    });
    expect(storedImageCreate).toHaveBeenCalledWith({
      data: {
        userId: 'target-user',
        tenantId: 'target-tenant',
        bucket: 'scorecards',
        objectKey: 'users/target-user/copies/image-1.jpg',
        originalFileName: 'league-night.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 12345
      }
    });
    expect(bowlingScoreCreateMany).toHaveBeenCalledWith({
      data: [
        {
          storedImageId: 'copied-image-1',
          playerId: 'target-player-1',
          gameIndex: 0,
          playerName: 'M C Brown',
          totalScore: 211,
          frames: [{ score: 20 }],
          tenthFrame: { score: 21 },
          provider: 'openai',
          isEstimate: true,
          rawText: 'raw estimate'
        },
        {
          storedImageId: 'copied-image-1',
          playerId: 'target-player-1',
          gameIndex: 0,
          playerName: 'M C Brown',
          totalScore: 214,
          frames: [{ score: 22 }],
          tenthFrame: { score: 24 },
          provider: 'manual',
          isEstimate: false,
          rawText: null
        }
      ]
    });
    expect(result.results).toEqual([
      {
        imageId: 'image-1',
        status: 'copied',
        destinationImageId: 'copied-image-1',
        destinationObjectKey: 'users/target-user/copies/image-1.jpg',
        scoreCount: 2
      }
    ]);
  });

  it('skips selected images that already have a destination copy', async () => {
    storedImageFindUnique
      .mockResolvedValueOnce(sourceImage)
      .mockResolvedValueOnce({ id: 'existing-copy' });

    const { copyStoredImagesToAccount } = await import('./copyStoredImages');
    const result = await copyStoredImagesToAccount({
      fromEmail: 'source@example.com',
      toEmail: 'target@example.com',
      imageIds: ['image-1'],
      execute: true
    });

    expect(result.results).toEqual([
      {
        imageId: 'image-1',
        status: 'skipped',
        reason: 'Destination copy already exists',
        destinationImageId: 'existing-copy',
        destinationObjectKey: 'users/target-user/copies/image-1.jpg'
      }
    ]);
    expect(copyObject).not.toHaveBeenCalled();
    expect(storedImageCreate).not.toHaveBeenCalled();
  });

  it('fails clearly when a user cannot be found', async () => {
    userFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'target-user',
      email: 'target@example.com'
    });

    const { copyStoredImagesToAccount } = await import('./copyStoredImages');

    await expect(
      copyStoredImagesToAccount({
        fromEmail: 'missing@example.com',
        toEmail: 'target@example.com',
        imageIds: ['image-1'],
        execute: false
      })
    ).rejects.toThrow('Source user not found: missing@example.com');
  });

  it('does not create destination records when storage copy fails', async () => {
    storedImageFindUnique.mockResolvedValueOnce(sourceImage).mockResolvedValueOnce(null);
    copyObject.mockRejectedValueOnce(new Error('storage unavailable'));

    const { copyStoredImagesToAccount } = await import('./copyStoredImages');
    const result = await copyStoredImagesToAccount({
      fromEmail: 'source@example.com',
      toEmail: 'target@example.com',
      imageIds: ['image-1'],
      execute: true
    });

    expect(result.results).toEqual([
      {
        imageId: 'image-1',
        status: 'failed',
        reason: 'storage unavailable'
      }
    ]);
    expect(storedImageCreate).not.toHaveBeenCalled();
    expect(bowlingScoreCreateMany).not.toHaveBeenCalled();
  });
});
