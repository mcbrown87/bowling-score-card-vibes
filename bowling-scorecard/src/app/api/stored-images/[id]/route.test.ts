const auth = jest.fn();
const getTenantAccessForSession = jest.fn();
const storedImageFindUnique = jest.fn();
const storedImageUpdate = jest.fn();
const bowlingTeamFindUnique = jest.fn();
const bowlingScoreUpdateMany = jest.fn();
const transaction = jest.fn(async (operations: unknown[]) => Promise.all(operations));
const findOrCreateTeamForName = jest.fn();
const serializeStoredImage = jest.fn();
const deleteObject = jest.fn();

class TestHeaders {
  private readonly values = new Map<string, string>();

  constructor(headers?: Record<string, string>) {
    Object.entries(headers ?? {}).forEach(([key, value]) => {
      this.values.set(key.toLowerCase(), value);
    });
  }

  get(key: string) {
    return this.values.get(key.toLowerCase()) ?? null;
  }
}

class TestResponse {
  readonly status: number;
  readonly headers: TestHeaders;

  constructor(
    private readonly body: unknown,
    init: { status?: number; headers?: Record<string, string> } = {}
  ) {
    this.status = init.status ?? 200;
    this.headers = new TestHeaders(init.headers);
  }

  async json() {
    return JSON.parse(String(this.body));
  }
}

jest.mock('next/server', () => ({
  NextResponse: Object.assign(TestResponse, {
    json: (data: unknown, init?: { status?: number; headers?: Record<string, string> }) =>
      new TestResponse(JSON.stringify(data), {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...init?.headers
        }
      })
  })
}));

jest.mock('@/server/auth', () => ({
  auth
}));

jest.mock('@/server/auth/tenant', () => ({
  getTenantAccessForSession
}));

jest.mock('@/server/db/client', () => ({
  prisma: {
    storedImage: {
      findUnique: storedImageFindUnique,
      update: storedImageUpdate,
      delete: jest.fn()
    },
    bowlingTeam: {
      findUnique: bowlingTeamFindUnique
    },
    bowlingScore: {
      updateMany: bowlingScoreUpdateMany
    },
    $transaction: transaction
  }
}));

jest.mock('@/server/storage/client', () => ({
  deleteObject
}));

jest.mock('@/server/services/bowlingTeams', () => ({
  findOrCreateTeamForName
}));

jest.mock('@/server/serializers/storedImage', () => ({
  storedImageInclude: { include: 'relations' },
  serializeStoredImage
}));

const context = { params: { id: 'image-1' } };

const buildRequest = (body: unknown) =>
  ({
    json: async () => body
  }) as Request;

describe('/api/stored-images/[id] team assignment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth.mockResolvedValue({ user: { id: 'user-1' } });
    getTenantAccessForSession.mockResolvedValue({
      tenantId: 'tenant-1',
      userId: 'user-1',
      canEdit: true
    });
    storedImageFindUnique.mockResolvedValue({ id: 'image-1', tenantId: 'tenant-1' });
    storedImageUpdate.mockResolvedValue({ id: 'image-1' });
    serializeStoredImage.mockReturnValue({ id: 'image-1', team: null });
  });

  it('requires authentication', async () => {
    auth.mockResolvedValue(null);

    const { PATCH } = await import('./route');
    const response = await PATCH(buildRequest({ teamId: null }), context);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Unauthorized'
    });
  });

  it('hides images outside the current tenant', async () => {
    storedImageFindUnique.mockResolvedValue({ id: 'image-1', tenantId: 'tenant-2' });

    const { PATCH } = await import('./route');
    const response = await PATCH(buildRequest({ teamId: null }), context);

    expect(response.status).toBe(404);
    expect(storedImageUpdate).not.toHaveBeenCalled();
  });

  it('attaches an existing team in the current tenant', async () => {
    bowlingTeamFindUnique.mockResolvedValue({ id: 'team-1', tenantId: 'tenant-1' });
    serializeStoredImage.mockReturnValue({
      id: 'image-1',
      team: { id: 'team-1', name: 'Wednesday League' }
    });

    const { PATCH } = await import('./route');
    const response = await PATCH(buildRequest({ teamId: 'team-1' }), context);

    expect(storedImageUpdate).toHaveBeenCalledWith({
      where: { id: 'image-1' },
      data: { teamId: 'team-1' },
      include: { include: 'relations' }
    });
    await expect(response.json()).resolves.toEqual({
      success: true,
      storedImage: {
        id: 'image-1',
        team: { id: 'team-1', name: 'Wednesday League' }
      }
    });
  });

  it('creates or reuses a team by name for the current user', async () => {
    findOrCreateTeamForName.mockResolvedValue({ id: 'team-new', name: 'Friday Night' });

    const { PATCH } = await import('./route');
    await PATCH(buildRequest({ teamName: ' Friday   Night ' }), context);

    expect(findOrCreateTeamForName).toHaveBeenCalledWith(
      expect.anything(),
      'tenant-1',
      'user-1',
      ' Friday   Night '
    );
    expect(storedImageUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { teamId: 'team-new' }
      })
    );
  });

  it('clears the image team', async () => {
    const { PATCH } = await import('./route');
    await PATCH(buildRequest({ teamId: null }), context);

    expect(storedImageUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { teamId: null }
      })
    );
  });

  it('marks an image as a league game and assigns a second tenant team', async () => {
    bowlingTeamFindUnique.mockResolvedValue({ id: 'team-2', tenantId: 'tenant-1' });

    const { PATCH } = await import('./route');
    const response = await PATCH(
      buildRequest({ isLeagueGame: true, opponentTeamId: 'team-2' }),
      context
    );

    expect(response.status).toBe(200);
    expect(storedImageUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { isLeagueGame: true, opponentTeamId: 'team-2' }
      })
    );
  });

  it('rejects assigning the same team to both sides of a league game', async () => {
    storedImageFindUnique.mockResolvedValue({
      id: 'image-1',
      tenantId: 'tenant-1',
      teamId: 'team-1',
      opponentTeamId: null
    });
    bowlingTeamFindUnique.mockResolvedValue({ id: 'team-1', tenantId: 'tenant-1' });

    const { PATCH } = await import('./route');
    const response = await PATCH(buildRequest({ opponentTeamId: 'team-1' }), context);

    expect(response.status).toBe(400);
    expect(storedImageUpdate).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'League games require two different teams'
    });
  });

  it('assigns the first four scores to team 1 and the last four to team 2', async () => {
    storedImageFindUnique.mockResolvedValue({
      id: 'image-1',
      tenantId: 'tenant-1',
      teamId: 'team-1',
      opponentTeamId: null
    });
    bowlingTeamFindUnique.mockResolvedValue({ id: 'team-2', tenantId: 'tenant-1' });
    storedImageUpdate.mockResolvedValue({
      id: 'image-1',
      isLeagueGame: true,
      teamId: 'team-1',
      opponentTeamId: 'team-2'
    });

    const { PATCH } = await import('./route');
    const response = await PATCH(buildRequest({ opponentTeamId: 'team-2' }), context);

    expect(response.status).toBe(200);
    expect(bowlingScoreUpdateMany).toHaveBeenNthCalledWith(1, {
      where: { storedImageId: 'image-1', gameIndex: { lt: 4 } },
      data: { teamId: 'team-1' }
    });
    expect(bowlingScoreUpdateMany).toHaveBeenNthCalledWith(2, {
      where: { storedImageId: 'image-1', gameIndex: { gte: 4 } },
      data: { teamId: 'team-2' }
    });
  });

  it('rejects missing team assignment payloads', async () => {
    const { PATCH } = await import('./route');
    const response = await PATCH(buildRequest({}), context);

    expect(response.status).toBe(400);
    expect(storedImageUpdate).not.toHaveBeenCalled();
  });
});
