const auth = jest.fn();
const bowlingTeamFindUnique = jest.fn();
const playerFindUnique = jest.fn();
const teamRosterPlayerStatusUpsert = jest.fn();

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
    player: {
      findUnique: playerFindUnique
    },
    teamRosterPlayerStatus: {
      upsert: teamRosterPlayerStatusUpsert
    }
  }
}));

const context = { params: { teamId: 'team-1', playerId: 'player-bob' } };

const buildRequest = (body: unknown) =>
  ({
    json: async () => body
  }) as Request;

describe('/api/bowling-teams/[teamId]/roster-status/[playerId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth.mockResolvedValue({ user: { id: 'user-1' } });
    bowlingTeamFindUnique.mockResolvedValue({ id: 'team-1', userId: 'user-1' });
    playerFindUnique.mockResolvedValue({ id: 'player-bob', userId: 'user-1' });
    teamRosterPlayerStatusUpsert.mockResolvedValue({
      teamId: 'team-1',
      playerId: 'player-bob',
      isDisabled: true
    });
  });

  it('requires authentication', async () => {
    auth.mockResolvedValue(null);

    const { PATCH } = await import('./route');
    const response = await PATCH(buildRequest({ isDisabled: true }), context);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Unauthorized'
    });
  });

  it('requires a boolean disabled status', async () => {
    const { PATCH } = await import('./route');
    const response = await PATCH(buildRequest({ isDisabled: 'yes' }), context);

    expect(response.status).toBe(400);
    expect(teamRosterPlayerStatusUpsert).not.toHaveBeenCalled();
  });

  it('hides players outside the current user account', async () => {
    playerFindUnique.mockResolvedValue({ id: 'player-bob', userId: 'other-user' });

    const { PATCH } = await import('./route');
    const response = await PATCH(buildRequest({ isDisabled: true }), context);

    expect(response.status).toBe(404);
    expect(teamRosterPlayerStatusUpsert).not.toHaveBeenCalled();
  });

  it('upserts the roster player status when disabling a player', async () => {
    const { PATCH } = await import('./route');
    const response = await PATCH(buildRequest({ isDisabled: true }), context);

    expect(teamRosterPlayerStatusUpsert).toHaveBeenCalledWith({
      where: {
        teamId_playerId: {
          teamId: 'team-1',
          playerId: 'player-bob'
        }
      },
      update: {
        isDisabled: true
      },
      create: {
        teamId: 'team-1',
        playerId: 'player-bob',
        isDisabled: true
      },
      select: {
        teamId: true,
        playerId: true,
        isDisabled: true
      }
    });
    await expect(response.json()).resolves.toEqual({
      success: true,
      rosterStatus: {
        teamId: 'team-1',
        playerId: 'player-bob',
        isDisabled: true
      }
    });
  });

  it('upserts the roster player status when enabling a player', async () => {
    teamRosterPlayerStatusUpsert.mockResolvedValue({
      teamId: 'team-1',
      playerId: 'player-bob',
      isDisabled: false
    });

    const { PATCH } = await import('./route');
    const response = await PATCH(buildRequest({ isDisabled: false }), context);

    expect(teamRosterPlayerStatusUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          isDisabled: false
        },
        create: {
          teamId: 'team-1',
          playerId: 'player-bob',
          isDisabled: false
        }
      })
    );
    await expect(response.json()).resolves.toEqual({
      success: true,
      rosterStatus: {
        teamId: 'team-1',
        playerId: 'player-bob',
        isDisabled: false
      }
    });
  });
});

export {};
