const auth = jest.fn();
const bowlingTeamFindMany = jest.fn();

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
      findMany: bowlingTeamFindMany
    }
  }
}));

describe('/api/bowling-teams', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires authentication', async () => {
    auth.mockResolvedValue(null);

    const { GET } = await import('./route');
    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Unauthorized'
    });
  });

  it('returns teams for the signed-in user', async () => {
    auth.mockResolvedValue({ user: { id: 'user-1' } });
    bowlingTeamFindMany.mockResolvedValue([{ id: 'team-1', name: 'Wednesday League' }]);

    const { GET } = await import('./route');
    const response = await GET();

    expect(bowlingTeamFindMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        name: true
      }
    });
    await expect(response.json()).resolves.toEqual({
      success: true,
      teams: [{ id: 'team-1', name: 'Wednesday League' }]
    });
  });
});
