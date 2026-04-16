const requireAdmin = jest.fn();
const buildValidatedScoreDatasetZipExport = jest.fn();

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
    return Buffer.isBuffer(this.body) ? this.body.toString() : String(this.body ?? '');
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
  buildValidatedScoreDatasetZipExport
}));

describe('/api/admin/training-dataset', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires an authenticated session', async () => {
    requireAdmin.mockResolvedValue({ session: null, isAdmin: false });

    const { GET } = await import('./route');
    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Unauthorized'
    });
  });

  it('forbids signed-in non-admin users', async () => {
    requireAdmin.mockResolvedValue({
      session: { user: { id: 'user-1' } },
      isAdmin: false
    });

    const { GET } = await import('./route');
    const response = await GET();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Forbidden'
    });
  });

  it('returns a downloadable zip for admins', async () => {
    requireAdmin.mockResolvedValue({
      session: { user: { id: 'admin-1' } },
      isAdmin: true
    });
    buildValidatedScoreDatasetZipExport.mockResolvedValue(Buffer.from('zip-bytes'));

    const { GET } = await import('./route');
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/zip');
    expect(response.headers.get('Content-Disposition')).toMatch(
      /^attachment; filename="bowling-validated-scores-\d{4}-\d{2}-\d{2}\.zip"$/
    );
    await expect(response.text()).resolves.toBe('zip-bytes');
  });
});
