import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { AdminConsole } from './AdminConsole';

const initialSettings = {
  activeProvider: 'openai' as const,
  openaiModel: 'gpt-4o',
  anthropicModel: 'claude-sonnet-4',
  localModelArtifactId: null,
  localModelName: 'local',
  mlServiceUrl: 'http://ml-service:8000'
};

const baseProps = {
  initialSettings,
  initialArtifacts: [],
  initialUsers: [
    { id: 'user-1', email: 'owner@example.com', name: 'Owner User' },
    { id: 'user-2', email: 'member@example.com', name: 'Member User' },
    { id: 'user-3', email: 'new@example.com', name: 'New Member' }
  ],
  datasetCounts: {
    datasetImageCount: 0,
    datasetCorrectionCount: 0
  }
};

const tenantOne = {
  id: 'tenant-1',
  name: 'League Night',
  createdAt: '2026-07-19T12:00:00.000Z',
  imageCount: 3,
  playerCount: 2,
  teamCount: 1,
  members: [
    {
      userId: 'user-1',
      email: 'owner@example.com',
      name: 'Owner User',
      role: 'OWNER' as const,
      isActiveTenant: true
    }
  ]
};

const tenantTwo = {
  id: 'tenant-2',
  name: 'Sunday Mixed',
  createdAt: '2026-07-19T13:00:00.000Z',
  imageCount: 0,
  playerCount: 0,
  teamCount: 0,
  members: [
    {
      userId: 'user-2',
      email: 'member@example.com',
      name: 'Member User',
      role: 'MEMBER' as const,
      isActiveTenant: false
    }
  ]
};

const renderAdminConsole = (initialTenants = [tenantOne, tenantTwo]) =>
  render(<AdminConsole {...baseProps} initialTenants={initialTenants} />);

describe('AdminConsole tenancy management', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('populates the member list from the selected tenant', () => {
    renderAdminConsole();

    expect(screen.getByLabelText('Tenancy role for owner@example.com')).toBeVisible();
    expect(screen.queryByLabelText('Tenancy role for member@example.com')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Sunday Mixed/ }));

    expect(screen.getByLabelText('Tenancy role for member@example.com')).toBeVisible();
    expect(screen.queryByLabelText('Tenancy role for owner@example.com')).not.toBeInTheDocument();
  });

  it('creates a tenant and selects it', async () => {
    const updatedTenants = [
      tenantOne,
      {
        id: 'tenant-3',
        name: 'Friday Doubles',
        createdAt: '2026-07-19T14:00:00.000Z',
        imageCount: 0,
        playerCount: 0,
        teamCount: 0,
        members: []
      }
    ];
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        tenant: updatedTenants[1],
        tenants: updatedTenants,
        users: baseProps.initialUsers
      })
    });

    renderAdminConsole([tenantOne]);

    fireEvent.change(screen.getByLabelText('New tenant'), {
      target: { value: 'Friday Doubles' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Create tenant/ }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/tenants/memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantName: 'Friday Doubles' })
      })
    );
    expect(await screen.findByText('No users have access to this tenant.')).toBeVisible();
    expect(screen.getByRole('button', { name: /Friday Doubles/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('adds an existing user to the selected tenant', async () => {
    const updatedTenant = {
      ...tenantOne,
      members: [
        ...tenantOne.members,
        {
          userId: 'user-3',
          email: 'new@example.com',
          name: 'New Member',
          role: 'MEMBER' as const,
          isActiveTenant: false
        }
      ]
    };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        tenant: { id: 'tenant-1', name: 'League Night' },
        user: { id: 'user-3', email: 'new@example.com', name: 'New Member' },
        membership: { tenantId: 'tenant-1', userId: 'user-3', role: 'MEMBER' },
        tenants: [updatedTenant],
        users: baseProps.initialUsers
      })
    });

    renderAdminConsole([tenantOne]);

    fireEvent.click(screen.getByRole('button', { name: 'New Member' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add user' }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/tenants/memberships', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: 'tenant-1',
          userEmail: 'new@example.com',
          role: 'MEMBER'
        })
      })
    );
    expect(await screen.findByLabelText('Tenancy role for new@example.com')).toBeVisible();
  });

  it('sets a selected member active tenant explicitly', async () => {
    const updatedTenant = {
      ...tenantTwo,
      members: [{ ...tenantTwo.members[0], isActiveTenant: true }]
    };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        membership: { tenantId: 'tenant-2', userId: 'user-2', role: 'MEMBER' },
        tenants: [tenantOne, updatedTenant],
        users: baseProps.initialUsers
      })
    });

    renderAdminConsole();
    fireEvent.click(screen.getByRole('button', { name: /Sunday Mixed/ }));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Set Sunday Mixed active for member@example.com'
      })
    );

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/tenants/memberships', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: 'tenant-2',
          userId: 'user-2',
          setActiveTenant: true
        })
      })
    );
    expect(await screen.findByText('Set Sunday Mixed as active for member@example.com.')).toBeVisible();
  });

  it('renames the selected tenant', async () => {
    const updatedTenant = {
      ...tenantOne,
      name: 'Renamed League'
    };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        tenant: { id: 'tenant-1', name: 'Renamed League' },
        tenants: [updatedTenant, tenantTwo],
        users: baseProps.initialUsers
      })
    });

    renderAdminConsole();

    fireEvent.change(screen.getByLabelText('Tenant name'), {
      target: { value: 'Renamed League' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/tenants/memberships', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: 'tenant-1',
          tenantName: 'Renamed League'
        })
      })
    );
    expect(await screen.findByText('Renamed tenant to Renamed League.')).toBeVisible();
    expect(
      screen
        .getAllByRole('button', { name: /Renamed League/ })
        .find((button) => button.getAttribute('aria-pressed') === 'true')
    ).toBeTruthy();
  });

  it('shows the backend message when adding a user that does not exist', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: 'User not found: missing@example.com'
      })
    });

    renderAdminConsole([tenantOne]);

    fireEvent.change(screen.getByLabelText('Add existing user by email'), {
      target: { value: 'missing@example.com' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add user' }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/tenants/memberships', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: 'tenant-1',
          userEmail: 'missing@example.com',
          role: 'MEMBER'
        })
      })
    );
    expect(await screen.findByText('User not found: missing@example.com')).toBeVisible();
  });

  it('changes a member role inline', async () => {
    const updatedTenant = {
      ...tenantTwo,
      members: [{ ...tenantTwo.members[0], role: 'OWNER' as const }]
    };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        membership: { tenantId: 'tenant-2', userId: 'user-2', role: 'OWNER' },
        tenants: [tenantOne, updatedTenant],
        users: baseProps.initialUsers
      })
    });

    renderAdminConsole();
    fireEvent.click(screen.getByRole('button', { name: /Sunday Mixed/ }));

    fireEvent.change(screen.getByLabelText('Tenancy role for member@example.com'), {
      target: { value: 'OWNER' }
    });

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/tenants/memberships', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: 'tenant-2',
          userId: 'user-2',
          role: 'OWNER'
        })
      })
    );
    expect(await screen.findByText('Updated member@example.com to OWNER.')).toBeVisible();
  });

  it('removes a member from the selected tenant', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        membership: { tenantId: 'tenant-2', userId: 'user-2', role: 'MEMBER' },
        tenants: [tenantOne, { ...tenantTwo, members: [] }],
        users: baseProps.initialUsers
      })
    });

    renderAdminConsole();
    fireEvent.click(screen.getByRole('button', { name: /Sunday Mixed/ }));

    const memberPanel = screen.getByText('Member User').closest('div')?.parentElement?.parentElement;
    expect(memberPanel).not.toBeNull();
    fireEvent.click(
      within(memberPanel as HTMLElement).getByRole('button', {
        name: 'Remove member@example.com from Sunday Mixed'
      })
    );

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/tenants/memberships', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: 'tenant-2',
          userId: 'user-2'
        })
      })
    );
    expect(await screen.findByText('No users have access to this tenant.')).toBeVisible();
  });
});
