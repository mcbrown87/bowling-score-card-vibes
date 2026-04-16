const requireAdmin = jest.fn();
const getRuntimeSettings = jest.fn();
const updateRuntimeSettings = jest.fn();

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

  async text() {
    return String(this.body ?? '');
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

jest.mock('@/server/auth/admin', () => ({
  requireAdmin
}));

jest.mock('@/server/config/appConfig', () => ({
  getRuntimeSettings,
  updateRuntimeSettings
}));

describe('/api/admin/settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects non-admin reads', async () => {
    requireAdmin.mockResolvedValue({ isAdmin: false });

    const { GET } = await import('./route');
    const response = await GET();

    await expect(response.json()).resolves.toEqual({ success: false, error: 'Forbidden' });
    expect(response.status).toBe(403);
  });

  it('returns runtime settings for admins', async () => {
    requireAdmin.mockResolvedValue({ isAdmin: true });
    getRuntimeSettings.mockResolvedValue({
      activeProvider: 'openai',
      openaiModel: 'gpt-4o'
    });

    const { GET } = await import('./route');
    const response = await GET();

    await expect(response.json()).resolves.toEqual({
      success: true,
      settings: {
        activeProvider: 'openai',
        openaiModel: 'gpt-4o'
      }
    });
  });

  it('updates valid settings for admins', async () => {
    requireAdmin.mockResolvedValue({ isAdmin: true });
    updateRuntimeSettings.mockResolvedValue({
      activeProvider: 'local',
      mlServiceUrl: 'http://ml-service:8000'
    });

    const { PUT } = await import('./route');
    const response = await PUT(
      {
        json: async () => ({
          activeProvider: 'local',
          mlServiceUrl: 'http://ml-service:8000'
        })
      } as Request
    );

    expect(updateRuntimeSettings).toHaveBeenCalledWith({
      activeProvider: 'local',
      mlServiceUrl: 'http://ml-service:8000'
    });
    await expect(response.json()).resolves.toEqual({
      success: true,
      settings: {
        activeProvider: 'local',
        mlServiceUrl: 'http://ml-service:8000'
      }
    });
  });

  it('rejects invalid settings payloads', async () => {
    requireAdmin.mockResolvedValue({ isAdmin: true });

    const { PUT } = await import('./route');
    const response = await PUT(
      {
        json: async () => ({
          activeProvider: 'bogus',
          mlServiceUrl: 'not-a-url'
        })
      } as Request
    );

    expect(response.status).toBe(400);
    expect(updateRuntimeSettings).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('Invalid enum value');
  });
});
