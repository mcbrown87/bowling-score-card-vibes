const requireAdmin = jest.fn();
const tenantFindMany = jest.fn();
const tenantCreate = jest.fn();
const tenantFindUnique = jest.fn();
const tenantUpdate = jest.fn();
const userFindUnique = jest.fn();
const userFindMany = jest.fn();
const userUpdate = jest.fn();
const tenantMembershipUpsert = jest.fn();
const tenantMembershipFindUnique = jest.fn();
const tenantMembershipFindFirst = jest.fn();
const tenantMembershipCount = jest.fn();
const tenantMembershipUpdate = jest.fn();
const tenantMembershipDelete = jest.fn();
const transaction = jest.fn();

const mockPrisma = {
  tenant: {
    findMany: tenantFindMany,
    create: tenantCreate,
    findUnique: tenantFindUnique,
    update: tenantUpdate
  },
  user: {
    findUnique: userFindUnique,
    findMany: userFindMany,
    update: userUpdate
  },
  tenantMembership: {
    upsert: tenantMembershipUpsert,
    findUnique: tenantMembershipFindUnique,
    findFirst: tenantMembershipFindFirst,
    count: tenantMembershipCount,
    update: tenantMembershipUpdate,
    delete: tenantMembershipDelete
  },
  $transaction: transaction
};

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

jest.mock('@/server/db/client', () => ({
  prisma: mockPrisma
}));

const requestWithBody = (body: unknown) =>
  ({
    json: async () => body
  }) as Request;

const tenantListRecord = {
  id: 'tenant-1',
  name: 'League Night',
  createdAt: new Date('2026-07-19T12:00:00.000Z'),
  _count: {
    storedImages: 4,
    players: 2,
    bowlingTeams: 1
  },
  memberships: [
    {
      role: 'OWNER',
      user: {
        id: 'user-1',
        email: 'owner@example.com',
        name: 'Owner User',
        activeTenantId: 'tenant-1'
      }
    }
  ]
};

describe('/api/admin/tenants/memberships', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAdmin.mockResolvedValue({ isAdmin: true, session: { user: { id: 'admin-1' } } });
    tenantFindMany.mockResolvedValue([tenantListRecord]);
    userFindMany.mockResolvedValue([
      { id: 'user-1', email: 'owner@example.com', name: 'Owner User' },
      { id: 'user-2', email: 'member@example.com', name: 'Member User' }
    ]);
    transaction.mockImplementation(async (callback) => callback(mockPrisma));
  });

  it('rejects non-admin reads', async () => {
    requireAdmin.mockResolvedValue({ isAdmin: false, session: { user: { id: 'user-1' } } });

    const { GET } = await import('./route');
    const response = await GET();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ success: false, error: 'Forbidden' });
  });

  it('creates a tenant', async () => {
    tenantCreate.mockResolvedValue({ id: 'tenant-2', name: 'Sunday Mixed' });

    const { POST } = await import('./route');
    const response = await POST(requestWithBody({ tenantName: 'Sunday Mixed' }));

    expect(tenantCreate).toHaveBeenCalledWith({
      data: { name: 'Sunday Mixed' },
      select: { id: true, name: true }
    });
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        tenant: { id: 'tenant-2', name: 'Sunday Mixed' },
        tenants: expect.any(Array),
        users: expect.any(Array)
      })
    );
  });

  it('adds an existing user to a selected tenant without switching their active tenant', async () => {
    tenantFindUnique.mockResolvedValue({ id: 'tenant-1', name: 'League Night' });
    userFindUnique.mockResolvedValue({ id: 'user-2', email: 'member@example.com', name: 'Member User' });
    tenantMembershipUpsert.mockResolvedValue({
      tenantId: 'tenant-1',
      userId: 'user-2',
      role: 'MEMBER'
    });

    const { PUT } = await import('./route');
    const response = await PUT(
      requestWithBody({
        tenantId: 'tenant-1',
        userEmail: 'member@example.com',
        role: 'MEMBER'
      })
    );

    expect(tenantMembershipUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_userId: { tenantId: 'tenant-1', userId: 'user-2' } },
        update: { role: 'MEMBER' },
        create: { tenantId: 'tenant-1', userId: 'user-2', role: 'MEMBER' }
      })
    );
    expect(userUpdate).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        user: { id: 'user-2', email: 'member@example.com', name: 'Member User' },
        users: expect.any(Array)
      })
    );
  });

  it('sets a member active tenant explicitly', async () => {
    tenantMembershipFindUnique.mockResolvedValue({
      tenantId: 'tenant-1',
      userId: 'user-2',
      role: 'MEMBER',
      user: { email: 'member@example.com', name: 'Member User' },
      tenant: { id: 'tenant-1', name: 'League Night' }
    });

    const { PATCH } = await import('./route');
    const response = await PATCH(
      requestWithBody({
        tenantId: 'tenant-1',
        userId: 'user-2',
        setActiveTenant: true
      })
    );

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-2' },
      data: { activeTenantId: 'tenant-1' }
    });
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        membership: expect.objectContaining({ userId: 'user-2' })
      })
    );
  });

  it('renames a tenant', async () => {
    tenantUpdate.mockResolvedValue({ id: 'tenant-1', name: 'League Night Renamed' });

    const { PATCH } = await import('./route');
    const response = await PATCH(
      requestWithBody({
        tenantId: 'tenant-1',
        tenantName: 'League Night Renamed'
      })
    );

    expect(tenantUpdate).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      data: { name: 'League Night Renamed' },
      select: { id: true, name: true }
    });
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        tenant: { id: 'tenant-1', name: 'League Night Renamed' },
        tenants: expect.any(Array),
        users: expect.any(Array)
      })
    );
  });

  it('rejects adding an email that does not belong to an existing user', async () => {
    userFindUnique.mockResolvedValue(null);

    const { PUT } = await import('./route');
    const response = await PUT(
      requestWithBody({
        tenantId: 'tenant-1',
        userEmail: 'missing@example.com',
        role: 'MEMBER'
      })
    );

    expect(response.status).toBe(400);
    expect(tenantMembershipUpsert).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'User not found: missing@example.com'
    });
  });

  it('updates an existing member role', async () => {
    tenantFindUnique.mockResolvedValue({ id: 'tenant-1', name: 'League Night' });
    tenantMembershipFindUnique.mockResolvedValue({ role: 'MEMBER' });
    tenantMembershipUpdate.mockResolvedValue({
      tenantId: 'tenant-1',
      userId: 'user-2',
      role: 'OWNER',
      user: { email: 'member@example.com', name: 'Member User' },
      tenant: { id: 'tenant-1', name: 'League Night' }
    });

    const { PATCH } = await import('./route');
    const response = await PATCH(
      requestWithBody({
        tenantId: 'tenant-1',
        userId: 'user-2',
        role: 'OWNER'
      })
    );

    expect(tenantMembershipUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { role: 'OWNER' }
      })
    );
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        membership: expect.objectContaining({ role: 'OWNER' })
      })
    );
  });

  it('rejects demoting the last owner for a tenant with data', async () => {
    tenantFindUnique.mockResolvedValue({ id: 'tenant-1', name: 'League Night' });
    tenantMembershipFindUnique
      .mockResolvedValueOnce({ role: 'OWNER' })
      .mockResolvedValueOnce({
        role: 'OWNER',
        user: { email: 'owner@example.com' },
        tenant: {
          name: 'League Night',
          _count: { storedImages: 1, players: 0, bowlingTeams: 0 }
        }
      });
    tenantMembershipCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    const { PATCH } = await import('./route');
    const response = await PATCH(
      requestWithBody({
        tenantId: 'tenant-1',
        userId: 'user-1',
        role: 'MEMBER'
      })
    );

    expect(response.status).toBe(400);
    expect(tenantMembershipUpdate).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.error).toContain('would have no owner');
  });

  it('rejects upserting an existing owner to member when it would leave tenant data ownerless', async () => {
    tenantFindUnique.mockResolvedValue({ id: 'tenant-1', name: 'League Night' });
    userFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.com',
      name: 'Owner User'
    });
    tenantMembershipFindUnique
      .mockResolvedValueOnce({ role: 'OWNER' })
      .mockResolvedValueOnce({
        role: 'OWNER',
        user: { email: 'owner@example.com' },
        tenant: {
          name: 'League Night',
          _count: { storedImages: 1, players: 0, bowlingTeams: 0 }
        }
      });
    tenantMembershipCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    const { PUT } = await import('./route');
    const response = await PUT(
      requestWithBody({
        tenantId: 'tenant-1',
        userEmail: 'owner@example.com',
        role: 'MEMBER'
      })
    );

    expect(response.status).toBe(400);
    expect(tenantMembershipUpsert).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.error).toContain('would have no owner');
  });

  it('removes a membership and clears the active tenant when no fallback exists', async () => {
    tenantFindUnique.mockResolvedValue({ id: 'tenant-1', name: 'League Night' });
    tenantMembershipFindUnique.mockResolvedValue({
      role: 'MEMBER',
      user: { email: 'member@example.com' },
      tenant: {
        name: 'League Night',
        _count: { storedImages: 0, players: 0, bowlingTeams: 0 }
      }
    });
    tenantMembershipDelete.mockResolvedValue({
      tenantId: 'tenant-1',
      userId: 'user-2',
      role: 'MEMBER',
      user: { email: 'member@example.com', name: 'Member User' },
      tenant: { id: 'tenant-1', name: 'League Night' }
    });
    userFindUnique.mockResolvedValue({ activeTenantId: 'tenant-1' });
    tenantMembershipFindFirst.mockResolvedValue(null);

    const { DELETE } = await import('./route');
    const response = await DELETE(requestWithBody({ tenantId: 'tenant-1', userId: 'user-2' }));

    expect(tenantMembershipDelete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_userId: { tenantId: 'tenant-1', userId: 'user-2' } }
      })
    );
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-2' },
      data: { activeTenantId: null }
    });
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        membership: expect.objectContaining({ userId: 'user-2' })
      })
    );
  });
});
