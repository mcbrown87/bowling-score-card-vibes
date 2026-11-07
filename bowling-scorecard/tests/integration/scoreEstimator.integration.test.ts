import { prisma } from '@/server/db/client';
import { processScoreEstimatorJob } from '@/server/services/scoreEstimator';
import { getObject } from '@/server/storage/client';
import { normalizeImageDataUrl } from '@/server/utils/image';
import { runProvider } from '@/server/providers';
import { getProviderModel, getRuntimeSettings } from '@/server/config/appConfig';
import { createTenantUserFixture, resetDatabase } from './helpers';

jest.mock('@/server/storage/client', () => ({
  getObject: jest.fn()
}));

jest.mock('@/server/utils/image', () => ({
  normalizeImageDataUrl: jest.fn()
}));

jest.mock('@/server/providers', () => ({
  runProvider: jest.fn()
}));

jest.mock('@/server/config/appConfig', () => ({
  getRuntimeSettings: jest.fn(),
  getProviderModel: jest.fn()
}));

jest.mock('@/server/utils/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn() }
}));

const mockGetObject = getObject as jest.MockedFunction<typeof getObject>;
const mockNormalizeImageDataUrl = normalizeImageDataUrl as jest.MockedFunction<
  typeof normalizeImageDataUrl
>;
const mockRunProvider = runProvider as jest.MockedFunction<typeof runProvider>;
const mockGetRuntimeSettings = getRuntimeSettings as jest.MockedFunction<typeof getRuntimeSettings>;
const mockGetProviderModel = getProviderModel as jest.MockedFunction<typeof getProviderModel>;

const buildGame = (playerName: string, totalScore = 20) => ({
  playerName,
  totalScore,
  frames: Array.from({ length: 9 }, () => ({
    rolls: [{ pins: 1 }, { pins: 1 }],
    isStrike: false,
    isSpare: false,
    score: 2
  })),
  tenthFrame: {
    rolls: [{ pins: 1 }, { pins: 1 }],
    isStrike: false,
    isSpare: false,
    score: totalScore
  }
});

async function createRequestFixture(options: { isLeagueGame?: boolean } = {}) {
  const fixture = await createTenantUserFixture(`estimator-${Date.now()}`);
  const image = await prisma.storedImage.create({
    data: {
      bucket: 'test-bucket',
      objectKey: `${fixture.user.id}/score.jpg`,
      originalFileName: 'score.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 128,
      isLeagueGame: options.isLeagueGame ?? false,
      tenantId: fixture.tenant.id,
      userId: fixture.user.id
    }
  });
  const prompt = await prisma.prompt.create({
    data: { version: `test-${image.id}`, content: 'extract scores' }
  });
  const request = await prisma.lLMRequest.create({
    data: {
      storedImageId: image.id,
      promptId: prompt.id,
      provider: 'openai',
      model: 'test-model',
      status: 'queued'
    }
  });

  return { ...fixture, image, request };
}

describe('score estimator processor with PostgreSQL', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await resetDatabase();
    mockGetRuntimeSettings.mockResolvedValue({ activeProvider: 'openai' });
    mockGetProviderModel.mockResolvedValue('test-model');
    mockGetObject.mockResolvedValue({ Body: Buffer.from('image bytes') });
    mockNormalizeImageDataUrl.mockResolvedValue({
      converted: false,
      dataUrl: 'data:image/jpeg;base64,aW1hZ2UgYnl0ZXM='
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('atomically replaces estimates, preserves corrections, and associates normalized players', async () => {
    const fixture = await createRequestFixture();
    await prisma.bowlingScore.createMany({
      data: [
        {
          storedImageId: fixture.image.id,
          gameIndex: 0,
          playerName: 'Old estimate',
          totalScore: 10,
          frames: [],
          isEstimate: true
        },
        {
          storedImageId: fixture.image.id,
          gameIndex: 0,
          playerName: 'Manual correction',
          totalScore: 30,
          frames: [],
          isEstimate: false
        }
      ]
    });
    mockRunProvider.mockResolvedValue({
      games: [buildGame('  Jane   Bowler ', 120)],
      model: 'provider-model',
      rawText: 'raw provider text',
      usage: null
    });

    await expect(
      processScoreEstimatorJob({
        storedImageId: fixture.image.id,
        llmRequestId: fixture.request.id
      })
    ).resolves.toEqual({ storedImageId: fixture.image.id, games: 1 });

    const request = await prisma.lLMRequest.findUniqueOrThrow({ where: { id: fixture.request.id } });
    expect(request.status).toBe('succeeded');
    expect(request.model).toBe('provider-model');
    expect(request.completedAt).not.toBeNull();

    const scores = await prisma.bowlingScore.findMany({
      where: { storedImageId: fixture.image.id },
      orderBy: { isEstimate: 'asc' },
      include: { player: true }
    });
    expect(scores).toHaveLength(2);
    expect(scores.find((score) => !score.isEstimate)?.playerName).toBe('Manual correction');
    const estimate = scores.find((score) => score.isEstimate);
    expect(estimate?.playerName).toBe('Jane Bowler');
    expect(estimate?.player?.normalizedName).toBe('jane bowler');
    expect(estimate?.totalScore).toBe(120);
  });

  it('marks the request failed and retains prior estimates when the provider rejects', async () => {
    const fixture = await createRequestFixture();
    const prior = await prisma.bowlingScore.create({
      data: {
        storedImageId: fixture.image.id,
        gameIndex: 0,
        playerName: 'Prior estimate',
        totalScore: 50,
        frames: [],
        isEstimate: true
      }
    });
    mockRunProvider.mockRejectedValue(new Error('provider unavailable'));

    await expect(
      processScoreEstimatorJob({
        storedImageId: fixture.image.id,
        llmRequestId: fixture.request.id
      })
    ).rejects.toThrow('provider unavailable');

    await expect(
      prisma.lLMRequest.findUniqueOrThrow({ where: { id: fixture.request.id } })
    ).resolves.toMatchObject({ status: 'failed', errorMessage: 'provider unavailable' });
    await expect(prisma.bowlingScore.findUnique({ where: { id: prior.id } })).resolves.not.toBeNull();
  });

  it('rejects incomplete league results before replacing existing estimates', async () => {
    const fixture = await createRequestFixture({ isLeagueGame: true });
    const prior = await prisma.bowlingScore.create({
      data: {
        storedImageId: fixture.image.id,
        gameIndex: 0,
        playerName: 'Prior league estimate',
        totalScore: 80,
        frames: [],
        isEstimate: true
      }
    });
    mockRunProvider.mockResolvedValue({
      games: [buildGame('Only Player')],
      model: 'test-model',
      rawText: null,
      usage: null
    });

    await expect(
      processScoreEstimatorJob({
        storedImageId: fixture.image.id,
        llmRequestId: fixture.request.id
      })
    ).rejects.toThrow('expected player scores');

    await expect(prisma.bowlingScore.findUnique({ where: { id: prior.id } })).resolves.not.toBeNull();
  });

  it('assigns extracted league players to the home and opponent teams by position', async () => {
    const fixture = await createRequestFixture({ isLeagueGame: true });
    const [homeTeam, opponentTeam] = await Promise.all([
      prisma.bowlingTeam.create({
        data: {
          name: 'Home Team',
          normalizedName: 'home team',
          tenantId: fixture.tenant.id,
          userId: fixture.user.id
        }
      }),
      prisma.bowlingTeam.create({
        data: {
          name: 'Opponent Team',
          normalizedName: 'opponent team',
          tenantId: fixture.tenant.id,
          userId: fixture.user.id
        }
      })
    ]);
    await prisma.storedImage.update({
      where: { id: fixture.image.id },
      data: { teamId: homeTeam.id, opponentTeamId: opponentTeam.id }
    });
    mockRunProvider.mockResolvedValue({
      games: Array.from({ length: 8 }, (_, index) => buildGame(`League Player ${index + 1}`)),
      model: 'test-model',
      rawText: null,
      usage: null
    });

    await processScoreEstimatorJob({
      storedImageId: fixture.image.id,
      llmRequestId: fixture.request.id
    });

    const scores = await prisma.bowlingScore.findMany({
      where: { storedImageId: fixture.image.id },
      orderBy: { gameIndex: 'asc' }
    });
    expect(scores.map((score) => score.teamId)).toEqual([
      homeTeam.id,
      homeTeam.id,
      homeTeam.id,
      homeTeam.id,
      opponentTeam.id,
      opponentTeam.id,
      opponentTeam.id,
      opponentTeam.id
    ]);
  });
});
