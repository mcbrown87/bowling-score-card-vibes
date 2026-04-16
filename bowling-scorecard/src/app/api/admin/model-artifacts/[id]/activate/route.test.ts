const requireAdmin = jest.fn();
const activateModelArtifact = jest.fn();

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

jest.mock('@/server/auth/admin', () => ({
  requireAdmin
}));

jest.mock('@/server/services/localModelArtifacts', () => ({
  activateModelArtifact
}));

describe('/api/admin/model-artifacts/[id]/activate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects non-admin activation requests', async () => {
    requireAdmin.mockResolvedValue({ isAdmin: false });

    const { POST } = await import('./route');
    const response = await POST({} as Request, {
      params: { id: 'artifact-1' }
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Forbidden'
    });
    expect(activateModelArtifact).not.toHaveBeenCalled();
  });

  it('activates an artifact for admins', async () => {
    requireAdmin.mockResolvedValue({ isAdmin: true });
    activateModelArtifact.mockResolvedValue({
      id: 'artifact-1',
      version: 'v1',
      isActive: true
    });

    const { POST } = await import('./route');
    const response = await POST({} as Request, {
      params: { id: 'artifact-1' }
    });

    expect(activateModelArtifact).toHaveBeenCalledWith('artifact-1');
    await expect(response.json()).resolves.toEqual({
      success: true,
      artifact: {
        id: 'artifact-1',
        version: 'v1',
        isActive: true
      }
    });
  });

  it('returns a bad request when activation fails', async () => {
    requireAdmin.mockResolvedValue({ isAdmin: true });
    activateModelArtifact.mockRejectedValue(new Error('Model artifact not found'));

    const { POST } = await import('./route');
    const response = await POST({} as Request, {
      params: { id: 'missing' }
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Model artifact not found'
    });
  });
});
