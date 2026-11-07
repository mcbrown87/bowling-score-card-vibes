import { prisma } from '@/server/db/client';
import { createTenantUserFixture, resetDatabase } from './helpers';
import { compare } from 'bcryptjs';

const auth = jest.fn();
const mockEnqueueScoreEstimatorJob = jest.fn();
const mockGetRuntimeSettings = jest.fn();
const mockGetProviderModel = jest.fn();

jest.mock('@/server/auth', () => ({ auth }));
jest.mock('@/server/queues/scoreEstimatorQueue', () => ({
  enqueueScoreEstimatorJob: mockEnqueueScoreEstimatorJob
}));
jest.mock('@/server/config/appConfig', () => ({
  getRuntimeSettings: mockGetRuntimeSettings,
  getProviderModel: mockGetProviderModel
}));

describe('API routes with PostgreSQL', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await resetDatabase();
    mockGetRuntimeSettings.mockResolvedValue({ activeProvider: 'openai' });
    mockGetProviderModel.mockResolvedValue('test-model');
    mockEnqueueScoreEstimatorJob.mockResolvedValue({ id: 'job-1' });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns only teams belonging to the signed-in active tenant', async () => {
    const active = await createTenantUserFixture('active-user');
    const other = await createTenantUserFixture('other-user');
    auth.mockResolvedValue({ user: { id: active.user.id } });

    await prisma.bowlingTeam.createMany({
      data: [
        {
          name: 'Visible Team',
          normalizedName: 'visible team',
          tenantId: active.tenant.id,
          userId: active.user.id
        },
        {
          name: 'Hidden Team',
          normalizedName: 'hidden team',
          tenantId: other.tenant.id,
          userId: other.user.id
        }
      ]
    });

    const { GET } = await import('@/app/api/bowling-teams/route');
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      teams: [expect.objectContaining({ name: 'Visible Team' })]
    });
  });

  it('persists a manual score correction and player association', async () => {
    const fixture = await createTenantUserFixture('score-editor');
    auth.mockResolvedValue({ user: { id: fixture.user.id } });
    const image = await prisma.storedImage.create({
      data: {
        bucket: 'test-bucket',
        objectKey: 'score-editor/image.jpg',
        tenantId: fixture.tenant.id,
        userId: fixture.user.id
      }
    });
    const frames = Array.from({ length: 9 }, () => ({
      rolls: [{ pins: 1 }, { pins: 1 }],
      score: 2
    }));
    const request = new Request('http://localhost/api/stored-images/image/scores/0', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        game: {
          playerName: '  Test   Bowler ',
          totalScore: 20,
          frames,
          tenthFrame: { rolls: [{ pins: 1 }, { pins: 1 }], score: 20 }
        }
      })
    });

    const { PUT } = await import('@/app/api/stored-images/[id]/scores/[gameIndex]/route');
    const response = await PUT(request, { params: { id: image.id, gameIndex: '0' } });

    expect(response.status).toBe(200);
    const score = await prisma.bowlingScore.findUniqueOrThrow({
      where: {
        storedImageId_gameIndex_isEstimate: {
          storedImageId: image.id,
          gameIndex: 0,
          isEstimate: false
        }
      },
      include: { player: true }
    });
    expect(score.playerName).toBe('Test Bowler');
    expect(score.player?.tenantId).toBe(fixture.tenant.id);
    expect(score.totalScore).toBe(20);
  });

  it('does not allow a signed-in user to update another tenant scorecard', async () => {
    const active = await createTenantUserFixture('active-editor');
    const other = await createTenantUserFixture('other-owner');
    auth.mockResolvedValue({ user: { id: active.user.id } });
    const image = await prisma.storedImage.create({
      data: {
        bucket: 'test-bucket',
        objectKey: 'other-owner/image.jpg',
        tenantId: other.tenant.id,
        userId: other.user.id
      }
    });
    const request = new Request('http://localhost/api/stored-images/image/scores/0', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ game: { frames: [], tenthFrame: null } })
    });

    const { PUT } = await import('@/app/api/stored-images/[id]/scores/[gameIndex]/route');
    const response = await PUT(request, { params: { id: image.id, gameIndex: '0' } });

    expect(response.status).toBe(404);
    await expect(prisma.bowlingScore.count()).resolves.toBe(0);
  });

  it('paginates stored images without leaking another tenant records', async () => {
    const active = await createTenantUserFixture('library-owner');
    const other = await createTenantUserFixture('other-library-owner');
    auth.mockResolvedValue({ user: { id: active.user.id } });
    await prisma.storedImage.createMany({
      data: [
        {
          bucket: 'test-bucket',
          objectKey: 'active/older.jpg',
          originalFileName: 'older.jpg',
          tenantId: active.tenant.id,
          userId: active.user.id,
          createdAt: new Date('2026-01-01T00:00:00Z')
        },
        {
          bucket: 'test-bucket',
          objectKey: 'active/newer.jpg',
          originalFileName: 'newer.jpg',
          tenantId: active.tenant.id,
          userId: active.user.id,
          createdAt: new Date('2026-01-02T00:00:00Z')
        },
        {
          bucket: 'test-bucket',
          objectKey: 'other/hidden.jpg',
          originalFileName: 'hidden.jpg',
          tenantId: other.tenant.id,
          userId: other.user.id
        }
      ]
    });

    const { GET } = await import('@/app/api/stored-images/route');
    const response = await GET(new Request('http://localhost/api/stored-images?page=1&pageSize=1'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      success: true,
      page: 1,
      pageSize: 1,
      totalImages: 2,
      totalPages: 2
    });
    expect(payload.images).toHaveLength(1);
    expect(payload.images[0].originalFileName).toBe('newer.jpg');
  });

  it('persists and enqueues one rescore request, then reuses it while active', async () => {
    const fixture = await createTenantUserFixture('rescore-owner');
    auth.mockResolvedValue({ user: { id: fixture.user.id } });
    const image = await prisma.storedImage.create({
      data: {
        bucket: 'test-bucket',
        objectKey: 'rescore/image.jpg',
        tenantId: fixture.tenant.id,
        userId: fixture.user.id
      }
    });
    const { POST } = await import('@/app/api/stored-images/[id]/rescore/route');

    const firstResponse = await POST(new Request('http://localhost'), { params: { id: image.id } });
    const firstPayload = await firstResponse.json();
    const secondResponse = await POST(new Request('http://localhost'), { params: { id: image.id } });
    const secondPayload = await secondResponse.json();

    expect(firstResponse.status).toBe(202);
    expect(secondResponse.status).toBe(202);
    expect(secondPayload.requestId).toBe(firstPayload.requestId);
    expect(mockEnqueueScoreEstimatorJob).toHaveBeenCalledTimes(1);
    expect(mockEnqueueScoreEstimatorJob).toHaveBeenCalledWith({
      storedImageId: image.id,
      llmRequestId: firstPayload.requestId
    });
    await expect(
      prisma.lLMRequest.findUniqueOrThrow({ where: { id: firstPayload.requestId } })
    ).resolves.toMatchObject({ status: 'queued', provider: 'openai', model: 'test-model' });
  });

  it('marks a rescore request failed when Redis enqueueing fails', async () => {
    const fixture = await createTenantUserFixture('failed-rescore');
    auth.mockResolvedValue({ user: { id: fixture.user.id } });
    mockEnqueueScoreEstimatorJob.mockRejectedValue(new Error('redis unavailable'));
    const image = await prisma.storedImage.create({
      data: {
        bucket: 'test-bucket',
        objectKey: 'failed-rescore/image.jpg',
        tenantId: fixture.tenant.id,
        userId: fixture.user.id
      }
    });
    const { POST } = await import('@/app/api/stored-images/[id]/rescore/route');
    const response = await POST(new Request('http://localhost'), { params: { id: image.id } });

    expect(response.status).toBe(500);
    await expect(
      prisma.lLMRequest.findFirstOrThrow({ where: { storedImageId: image.id } })
    ).resolves.toMatchObject({ status: 'failed', errorMessage: 'redis unavailable' });
  });

  it(
    'creates a hashed-password account with an owner tenant and rejects duplicate email',
    async () => {
      const { POST } = await import('@/app/api/auth/signup/route');
      const signupBody = {
        name: 'New Bowler',
        email: 'new-bowler@example.test',
        password: 'safe-password-123'
      };
      const makeRequest = () =>
        new Request('http://localhost/api/auth/signup', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(signupBody)
        });

      const response = await POST(makeRequest());
      const duplicateResponse = await POST(makeRequest());

      expect(response.status).toBe(200);
      expect(duplicateResponse.status).toBe(409);
      const user = await prisma.user.findUniqueOrThrow({
        where: { email: signupBody.email },
        include: { tenantMemberships: true }
      });
      expect(user.passwordHash).not.toBe(signupBody.password);
      await expect(compare(signupBody.password, user.passwordHash as string)).resolves.toBe(true);
      expect(user.activeTenantId).not.toBeNull();
      expect(user.tenantMemberships).toEqual([
        expect.objectContaining({ tenantId: user.activeTenantId, role: 'OWNER' })
      ]);
    },
    30_000
  );

  it('rejects an invalid signup without writing a partial user', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const { POST } = await import('@/app/api/auth/signup/route');
      const response = await POST(
        new Request('http://localhost/api/auth/signup', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Short Password', email: 'invalid@example.test', password: 'short' })
        })
      );

      expect(response.status).toBe(400);
      await expect(prisma.user.count()).resolves.toBe(0);
    } finally {
      consoleError.mockRestore();
    }
  });
});
