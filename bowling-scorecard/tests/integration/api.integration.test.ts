import { prisma } from '@/server/db/client';
import { createTenantUserFixture, resetDatabase } from './helpers';

const auth = jest.fn();

jest.mock('@/server/auth', () => ({ auth }));

describe('API routes with PostgreSQL', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await resetDatabase();
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
});
