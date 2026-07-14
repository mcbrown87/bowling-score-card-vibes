const auth = jest.fn();
const bowlingTeamFindUnique = jest.fn();
const teamRosterPlayerStatusFindMany = jest.fn();

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
    bowlingTeam: {
      findUnique: bowlingTeamFindUnique
    },
    teamRosterPlayerStatus: {
      findMany: teamRosterPlayerStatusFindMany
    }
  }
}));

const context = { params: { teamId: 'team-1' } };

describe('/api/bowling-teams/[teamId]/roster-status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth.mockResolvedValue({ user: { id: 'user-1' } });
    bowlingTeamFindUnique.mockResolvedValue({ id: 'team-1', userId: 'user-1' });
    teamRosterPlayerStatusFindMany.mockResolvedValue([{ playerId: 'player-bob' }]);
  });

  it('requires authentication', async () => {
    auth.mockResolvedValue(null);

    const { GET } = await import('./route');
    const response = await GET({} as Request, context);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Unauthorized'
    });
  });

  it('hides teams outside the current user account', async () => {
    bowlingTeamFindUnique.mockResolvedValue({ id: 'team-1', userId: 'other-user' });

    const { GET } = await import('./route');
    const response = await GET({} as Request, context);

    expect(response.status).toBe(404);
    expect(teamRosterPlayerStatusFindMany).not.toHaveBeenCalled();
  });

  it('returns disabled roster player ids', async () => {
    const { GET } = await import('./route');
    const response = await GET({} as Request, context);

    expect(teamRosterPlayerStatusFindMany).toHaveBeenCalledWith({
      where: {
        teamId: 'team-1',
        isDisabled: true
      },
      select: {
        playerId: true
      }
    });
    await expect(response.json()).resolves.toEqual({
      success: true,
      disabledPlayerIds: ['player-bob']
    });
  });
});

export {};
