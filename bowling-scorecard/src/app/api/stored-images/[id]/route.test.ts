const auth = jest.fn();
const storedImageFindUnique = jest.fn();
const storedImageUpdate = jest.fn();
const bowlingTeamFindUnique = jest.fn();
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

jest.mock('@/server/db/client', () => ({
  prisma: {
    storedImage: {
      findUnique: storedImageFindUnique,
      update: storedImageUpdate,
      delete: jest.fn()
    },
    bowlingTeam: {
      findUnique: bowlingTeamFindUnique
    }
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
    storedImageFindUnique.mockResolvedValue({ id: 'image-1', userId: 'user-1' });
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

  it('hides images outside the current user account', async () => {
    storedImageFindUnique.mockResolvedValue({ id: 'image-1', userId: 'other-user' });

    const { PATCH } = await import('./route');
    const response = await PATCH(buildRequest({ teamId: null }), context);

    expect(response.status).toBe(404);
    expect(storedImageUpdate).not.toHaveBeenCalled();
  });

  it('attaches an existing team owned by the current user', async () => {
    bowlingTeamFindUnique.mockResolvedValue({ id: 'team-1', userId: 'user-1' });
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

  it('rejects missing team assignment payloads', async () => {
    const { PATCH } = await import('./route');
    const response = await PATCH(buildRequest({}), context);

    expect(response.status).toBe(400);
    expect(storedImageUpdate).not.toHaveBeenCalled();
  });
});
