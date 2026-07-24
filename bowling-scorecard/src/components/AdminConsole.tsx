'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, Plus, RefreshCw, Trash2, UserPlus, Users } from 'lucide-react';

type RuntimeSettings = {
  activeProvider: 'anthropic' | 'openai' | 'local' | 'stub';
  openaiModel: string;
  anthropicModel: string;
  localModelArtifactId: string | null;
  localModelName: string;
  mlServiceUrl: string;
};

type ModelArtifact = {
  id: string;
  name: string;
  version: string;
  architecture: string;
  localPath: string | null;
  isActive: boolean;
  metrics: Record<string, unknown> | null;
};

type TenantMember = {
  userId: string;
  email: string;
  name: string | null;
  role: 'OWNER' | 'MEMBER';
  isActiveTenant: boolean;
};

type TenantSummary = {
  id: string;
  name: string;
  createdAt: string;
  imageCount: number;
  playerCount: number;
  teamCount: number;
  members: TenantMember[];
};

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
};

type AdminConsoleProps = {
  initialSettings: RuntimeSettings;
  initialArtifacts: ModelArtifact[];
  initialTenants: TenantSummary[];
  initialUsers: AdminUser[];
  datasetCounts: {
    datasetImageCount: number;
    datasetCorrectionCount: number;
  };
};

const cardStyle = {
  border: '1px solid #334155',
  borderRadius: '18px',
  padding: '20px',
  background: 'linear-gradient(180deg, #0b1738 0%, #08102a 100%)',
  boxShadow: '0 18px 36px rgba(2, 6, 23, 0.45)'
} as const;

const labelStyle = {
  display: 'grid',
  gap: '6px',
  fontWeight: 600,
  color: '#cbd5e1'
} as const;

const inputStyle = {
  borderRadius: '10px',
  border: '1px solid #475569',
  padding: '10px 12px',
  fontSize: '14px',
  background: '#0f172a',
  color: '#f8fafc'
} as const;

const buttonStyle = {
  alignItems: 'center',
  borderRadius: '8px',
  border: 'none',
  background: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)',
  color: '#f8fafc',
  display: 'inline-flex',
  font: 'inherit',
  padding: '10px 16px',
  fontWeight: 700,
  justifyContent: 'center',
  lineHeight: 1.2,
  minHeight: '42px',
  cursor: 'pointer',
  boxShadow: '0 12px 24px rgba(14, 165, 233, 0.22)'
} as const;

const secondaryButtonStyle = {
  ...buttonStyle,
  textDecoration: 'none',
  background: '#164e63',
  boxShadow: 'none'
} as const;

const subtleButtonStyle = {
  ...buttonStyle,
  background: '#1e293b',
  boxShadow: 'none',
  border: '1px solid #475569'
} as const;

const disabledButtonStyle = {
  ...subtleButtonStyle,
  opacity: 0.52,
  cursor: 'not-allowed'
} as const;

const datasetDownloadFileName = () => {
  const date = new Date().toISOString().slice(0, 10);
  return `bowling-validated-scores-${date}.zip`;
};

export function AdminConsole({
  initialSettings,
  initialArtifacts,
  initialTenants,
  initialUsers,
  datasetCounts
}: AdminConsoleProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [artifacts, setArtifacts] = useState(initialArtifacts);
  const [tenants, setTenants] = useState(initialTenants);
  const [users, setUsers] = useState(initialUsers);
  const [tenantId, setTenantId] = useState(initialTenants[0]?.id ?? '');
  const [newTenantName, setNewTenantName] = useState('');
  const [selectedTenantName, setSelectedTenantName] = useState(initialTenants[0]?.name ?? '');
  const [tenantUserEmail, setTenantUserEmail] = useState('');
  const [tenantRole, setTenantRole] = useState<TenantMember['role']>('MEMBER');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [artifactFile, setArtifactFile] = useState<File | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [savingTenant, setSavingTenant] = useState(false);
  const [creatingTenant, setCreatingTenant] = useState(false);
  const [renamingTenant, setRenamingTenant] = useState(false);
  const [mutatingMemberId, setMutatingMemberId] = useState<string | null>(null);
  const [downloadingDataset, setDownloadingDataset] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === tenantId) ?? tenants[0] ?? null,
    [tenantId, tenants]
  );
  const selectedTenantOwners = selectedTenant?.members.filter((member) => member.role === 'OWNER') ?? [];
  const selectedTenantMemberEmails = useMemo(
    () => new Set(selectedTenant?.members.map((member) => member.email) ?? []),
    [selectedTenant]
  );
  const availableTenantUsers = useMemo(
    () => users.filter((user) => !selectedTenantMemberEmails.has(user.email)),
    [selectedTenantMemberEmails, users]
  );
  const trimmedSelectedTenantName = selectedTenantName.trim();

  useEffect(() => {
    setSelectedTenantName(selectedTenant?.name ?? '');
  }, [selectedTenant?.id, selectedTenant?.name]);

  const refreshTenants = useCallback(async () => {
    const response = await fetch('/api/admin/tenants/memberships');
    const data = await response.json();

    if (!response.ok || !data?.success) {
      throw new Error(data?.error ?? 'Unable to refresh tenants');
    }

    setTenants(data.tenants);
    setUsers(data.users);
    if (!tenantId && data.tenants[0]?.id) {
      setTenantId(data.tenants[0].id);
    }
  }, [tenantId]);

  const refreshArtifacts = useCallback(async () => {
    setRefreshing(true);
    setMessage(null);

    try {
      const artifactsResponse = await fetch('/api/admin/model-artifacts');
      const artifactsData = await artifactsResponse.json();

      if (!artifactsResponse.ok) {
        throw new Error(artifactsData.error ?? 'Unable to refresh model artifacts');
      }

      setArtifacts(artifactsData.artifacts);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to refresh model artifacts');
    } finally {
      setRefreshing(false);
    }
  }, []);

  const downloadTrainingDataset = async () => {
    setDownloadingDataset(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/training-dataset');
      if (!response.ok) {
        throw new Error('Unable to download training dataset');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = datasetDownloadFileName();
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage('Training dataset download started.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to download training dataset');
    } finally {
      setDownloadingDataset(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to save settings');
      }

      setSettings(data.settings);
      setMessage('Settings updated.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save settings');
    } finally {
      setSaving(false);
    }
  };

  const activateArtifact = async (artifactId: string) => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/model-artifacts/${artifactId}/activate`, {
        method: 'POST'
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to activate model');
      }

      setSettings((current) => ({
        ...current,
        activeProvider: 'local',
        localModelArtifactId: artifactId,
        localModelName: data.artifact.version
      }));
      setMessage('Local model activated and provider switched to local.');
      await refreshArtifacts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to activate model');
    } finally {
      setSaving(false);
    }
  };

  const importArtifact = async () => {
    if (!artifactFile) {
      setMessage('Choose a model artifact archive first.');
      return;
    }

    setImporting(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.set('file', artifactFile);
      const response = await fetch('/api/admin/model-artifacts/import', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to import model artifact');
      }

      setArtifactFile(null);
      setMessage(`Imported ${data.artifact.name} / ${data.artifact.version}.`);
      await refreshArtifacts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to import model artifact');
    } finally {
      setImporting(false);
    }
  };

  const saveTenantMembership = async () => {
    const trimmedUserEmail = tenantUserEmail.trim();

    if (!trimmedUserEmail) {
      setMessage('Enter an existing user email before assigning tenancy.');
      return;
    }

    if (!tenantId) {
      setMessage('Select a tenant before assigning users.');
      return;
    }

    setSavingTenant(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/tenants/memberships', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          userEmail: trimmedUserEmail,
          role: tenantRole
        })
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error ?? 'Unable to save tenant membership');
      }

      setTenantUserEmail('');
      setTenants(data.tenants);
      setUsers(data.users);
      setMessage(`Added ${data.user.email} to ${data.tenant.name} as ${data.membership.role}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save tenant membership');
    } finally {
      setSavingTenant(false);
    }
  };

  const updateTenantMemberRole = async (member: TenantMember, role: TenantMember['role']) => {
    if (!selectedTenant || member.role === role) {
      return;
    }

    setMutatingMemberId(member.userId);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/tenants/memberships', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: selectedTenant.id,
          userId: member.userId,
          role
        })
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error ?? 'Unable to update tenant member role');
      }

      setTenants(data.tenants);
      setUsers(data.users);
      setMessage(`Updated ${member.email} to ${role}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update tenant member role');
    } finally {
      setMutatingMemberId(null);
    }
  };

  const setActiveTenantForMember = async (member: TenantMember) => {
    if (!selectedTenant || member.isActiveTenant) {
      return;
    }

    setMutatingMemberId(member.userId);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/tenants/memberships', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: selectedTenant.id,
          userId: member.userId,
          setActiveTenant: true
        })
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error ?? 'Unable to set active tenant');
      }

      setTenants(data.tenants);
      setUsers(data.users);
      setMessage(`Set ${selectedTenant.name} as active for ${member.email}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to set active tenant');
    } finally {
      setMutatingMemberId(null);
    }
  };

  const removeTenantMember = async (member: TenantMember) => {
    if (!selectedTenant) {
      return;
    }

    setMutatingMemberId(member.userId);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/tenants/memberships', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: selectedTenant.id,
          userId: member.userId
        })
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error ?? 'Unable to remove tenant member');
      }

      setTenants(data.tenants);
      setUsers(data.users);
      setMessage(`Removed ${member.email} from ${selectedTenant.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to remove tenant member');
    } finally {
      setMutatingMemberId(null);
    }
  };

  const createTenant = async () => {
    const trimmedTenantName = newTenantName.trim();

    if (!trimmedTenantName) {
      setMessage('Enter a tenant name before creating it.');
      return;
    }

    setCreatingTenant(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/tenants/memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantName: trimmedTenantName
        })
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error ?? 'Unable to create tenant');
      }

      setNewTenantName('');
      setTenantId(data.tenant.id);
      setTenants(data.tenants);
      setUsers(data.users);
      setMessage(`Created tenant ${data.tenant.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create tenant');
    } finally {
      setCreatingTenant(false);
    }
  };

  const renameSelectedTenant = async () => {
    if (!selectedTenant) {
      return;
    }

    if (!trimmedSelectedTenantName) {
      setMessage('Enter a tenant name before renaming it.');
      return;
    }

    if (trimmedSelectedTenantName === selectedTenant.name) {
      setMessage('Tenant name is already up to date.');
      return;
    }

    setRenamingTenant(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/tenants/memberships', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: selectedTenant.id,
          tenantName: trimmedSelectedTenantName
        })
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error ?? 'Unable to rename tenant');
      }

      setTenants(data.tenants);
      setUsers(data.users);
      setMessage(`Renamed tenant to ${data.tenant.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to rename tenant');
    } finally {
      setRenamingTenant(false);
    }
  };

  return (
    <div
      style={{
        display: 'grid',
        gap: '20px',
        padding: '24px 16px 40px',
        maxWidth: '1200px',
        margin: '0 auto'
      }}
    >
      <section
        style={{
          ...cardStyle,
          background:
            'radial-gradient(circle at top right, rgba(14, 165, 233, 0.18), transparent 28%), linear-gradient(180deg, #0b1738 0%, #08102a 100%)'
        }}
      >
        <h1 style={{ margin: 0, fontSize: '32px', color: '#f8fafc' }}>Admin Console</h1>
        <p style={{ margin: '8px 0 0', color: '#93c5fd', maxWidth: '760px' }}>
          Manage OCR provider routing, export validated scores, and activate imported local model
          artifacts without changing environment variables.
        </p>
      </section>

      <section style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, color: '#f8fafc' }}>Dataset snapshot</h2>
            <p style={{ margin: '6px 0 0', color: '#93c5fd' }}>
              {datasetCounts.datasetImageCount} corrected images, {datasetCounts.datasetCorrectionCount} corrected games
            </p>
            <p style={{ margin: '6px 0 0', color: '#cbd5e1', maxWidth: '760px' }}>
              Download this dataset for offline training, then import the trained artifact below.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={downloadTrainingDataset}
              disabled={downloadingDataset}
              style={secondaryButtonStyle}
            >
              {downloadingDataset ? 'Downloading...' : 'Download training dataset'}
            </button>
            <button type="button" style={buttonStyle} onClick={refreshArtifacts} disabled={refreshing}>
              {refreshing ? 'Refreshing...' : 'Refresh artifacts'}
            </button>
          </div>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, color: '#f8fafc' }}>Tenancy</h2>
            <p style={{ margin: '6px 0 0', color: '#cbd5e1', maxWidth: '780px' }}>
              Create shared bowling datasets, select a tenant, then manage that tenant&apos;s users.
            </p>
          </div>
          <button
            type="button"
            style={secondaryButtonStyle}
            onClick={() => {
              void refreshTenants().catch((error) => {
                setMessage(error instanceof Error ? error.message : 'Unable to refresh tenants');
              });
            }}
          >
            <RefreshCw size={16} aria-hidden />
            Refresh
          </button>
        </div>

        <div
          style={{
            alignItems: 'end',
            border: '1px solid #334155',
            borderRadius: '12px',
            display: 'grid',
            gap: '12px',
            gridTemplateColumns: 'minmax(220px, 1fr) auto',
            marginTop: '16px',
            padding: '14px',
            background: '#0f172a'
          }}
        >
          <label style={labelStyle}>
            New tenant
            <input
              value={newTenantName}
              onChange={(event) => setNewTenantName(event.target.value)}
              style={inputStyle}
            />
          </label>
          <button
            type="button"
            style={buttonStyle}
            onClick={createTenant}
            disabled={creatingTenant}
          >
            <Plus size={16} aria-hidden />
            {creatingTenant ? 'Creating...' : 'Create tenant'}
          </button>
        </div>

        <div
          style={{
            borderTop: '1px solid #334155',
            display: 'grid',
            gap: '14px',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            marginTop: '18px',
            paddingTop: '18px'
          }}
        >
          <label style={labelStyle}>
            Add existing user by email
            <input
              list="tenant-user-options"
              type="email"
              aria-label="Add existing user by email"
              value={tenantUserEmail}
              onChange={(event) => setTenantUserEmail(event.target.value)}
              disabled={!selectedTenant}
              style={inputStyle}
            />
            <datalist id="tenant-user-options">
              {availableTenantUsers.map((user) => (
                <option key={user.id} value={user.email}>
                  {user.name ? `${user.name} (${user.email})` : user.email}
                </option>
              ))}
            </datalist>
          </label>
          <label style={labelStyle}>
            Role
            <select
              value={tenantRole}
              onChange={(event) => setTenantRole(event.target.value as TenantMember['role'])}
              disabled={!selectedTenant}
              style={inputStyle}
            >
              <option value="MEMBER">Read-only member</option>
              <option value="OWNER">Owner</option>
            </select>
          </label>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '16px' }}>
          <button
            type="button"
            style={buttonStyle}
            onClick={saveTenantMembership}
            disabled={savingTenant || !selectedTenant}
          >
            <UserPlus size={16} aria-hidden />
            {savingTenant ? 'Saving...' : 'Add user'}
          </button>
          {selectedTenantOwners.length === 0 && (
            <span style={{ color: '#fca5a5', alignSelf: 'center', fontWeight: 700 }}>
              This tenant has no owner.
            </span>
          )}
          {selectedTenant && availableTenantUsers.length === 0 && (
            <span style={{ color: '#93c5fd', alignSelf: 'center' }}>
              Every existing user already has access to this tenant.
            </span>
          )}
        </div>
        {selectedTenant && availableTenantUsers.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
              marginTop: '10px'
            }}
          >
            {availableTenantUsers.slice(0, 6).map((user) => (
              <button
                key={user.id}
                type="button"
                style={subtleButtonStyle}
                onClick={() => setTenantUserEmail(user.email)}
              >
                {user.name ?? user.email}
              </button>
            ))}
          </div>
        )}

        <div
          style={{
            alignItems: 'start',
            display: 'grid',
            gap: '18px',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
            marginTop: '18px'
          }}
        >
          <div>
            <h3 style={{ margin: '0 0 10px', color: '#f8fafc' }}>Tenants</h3>
            <div
              style={{
                display: 'grid',
                gap: '10px',
                maxHeight: 'min(52vh, 560px)',
                overflowY: 'auto',
                paddingRight: '4px'
              }}
            >
              {tenants.map((tenant) => {
                const ownerCount = tenant.members.filter((member) => member.role === 'OWNER').length;
                const isSelected = selectedTenant?.id === tenant.id;

                return (
                  <button
                    key={tenant.id}
                    type="button"
                    onClick={() => setTenantId(tenant.id)}
                    style={{
                      border: isSelected ? '2px solid #38bdf8' : '1px solid #334155',
                      borderRadius: '8px',
                      background: isSelected ? '#10264a' : '#0f172a',
                      color: '#f8fafc',
                      cursor: 'pointer',
                      display: 'grid',
                      gap: '8px',
                      padding: '12px',
                      textAlign: 'left',
                      width: '100%'
                    }}
                    aria-pressed={isSelected}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Building2 size={18} color="#7dd3fc" aria-hidden />
                      <span>
                        <strong>{tenant.name}</strong>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '12px', marginTop: '2px' }}>
                          {tenant.id}
                        </span>
                      </span>
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: '13px' }}>
                      {tenant.imageCount} images · {tenant.playerCount} players · {tenant.teamCount} teams
                    </span>
                    <span style={{ color: ownerCount === 0 ? '#fca5a5' : '#cbd5e1', fontSize: '13px' }}>
                      {ownerCount} owner{ownerCount === 1 ? '' : 's'} · {tenant.members.length} member
                      {tenant.members.length === 1 ? '' : 's'}
                    </span>
                  </button>
                );
              })}
            </div>
            {tenants.length === 0 && (
              <p style={{ margin: '14px 8px 0', color: '#93c5fd' }}>No tenants yet.</p>
            )}
          </div>

          <aside
            style={{
              border: '1px solid #334155',
              borderRadius: '12px',
              background: '#0f172a',
              maxHeight: 'min(52vh, 560px)',
              overflowY: 'auto',
              padding: '16px'
            }}
          >
            {selectedTenant ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Building2 size={22} color="#7dd3fc" aria-hidden />
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ margin: 0, color: '#f8fafc' }}>{selectedTenant.name}</h3>
                    <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '13px' }}>
                      Created {new Date(selectedTenant.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div
                  style={{
                    alignItems: 'end',
                    display: 'grid',
                    gap: '8px',
                    gridTemplateColumns: 'minmax(180px, 1fr) auto',
                    marginTop: '14px'
                  }}
                >
                  <label style={labelStyle}>
                    Tenant name
                    <input
                      value={selectedTenantName}
                      onChange={(event) => setSelectedTenantName(event.target.value)}
                      style={inputStyle}
                    />
                  </label>
                  <button
                    type="button"
                    style={
                      renamingTenant ||
                      !trimmedSelectedTenantName ||
                      trimmedSelectedTenantName === selectedTenant.name
                        ? disabledButtonStyle
                        : subtleButtonStyle
                    }
                    onClick={renameSelectedTenant}
                    disabled={
                      renamingTenant ||
                      !trimmedSelectedTenantName ||
                      trimmedSelectedTenantName === selectedTenant.name
                    }
                  >
                    {renamingTenant ? 'Saving...' : 'Rename'}
                  </button>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '8px',
                    marginTop: '14px'
                  }}
                >
                  {[
                    ['Images', selectedTenant.imageCount],
                    ['Players', selectedTenant.playerCount],
                    ['Teams', selectedTenant.teamCount]
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      style={{
                        border: '1px solid #1e293b',
                        borderRadius: '10px',
                        padding: '10px',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ color: '#f8fafc', fontSize: '20px', fontWeight: 800 }}>
                        {value}
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '12px' }}>{label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gap: '10px', marginTop: '16px' }}>
                  <div
                    style={{
                      border: '1px solid #1e293b',
                      borderRadius: '10px',
                      display: 'grid',
                      gap: '8px',
                      padding: '10px'
                    }}
                  >
                    <div style={{ color: '#7dd3fc', fontWeight: 800 }}>Role guide</div>
                    <div style={{ color: '#cbd5e1', fontSize: '13px' }}>
                      <strong style={{ color: '#f8fafc' }}>Owner:</strong> can upload, edit scores,
                      manage teams, delete images, and manage roster state.
                    </div>
                    <div style={{ color: '#cbd5e1', fontSize: '13px' }}>
                      <strong style={{ color: '#f8fafc' }}>Member:</strong> can browse shared images,
                      players, teams, and scores without changing tenant data.
                    </div>
                  </div>
                  <h4 style={{ margin: 0, color: '#f8fafc' }}>
                    <Users size={16} aria-hidden style={{ verticalAlign: '-3px', marginRight: '6px' }} />
                    Members
                  </h4>
                  {selectedTenant.members.length === 0 ? (
                    <p style={{ margin: 0, color: '#93c5fd' }}>No users have access to this tenant.</p>
                  ) : (
                    selectedTenant.members.map((member) => {
                      const isMutating = mutatingMemberId === member.userId;

                      return (
                        <div
                          key={member.userId}
                          style={{
                            border: '1px solid #1e293b',
                            borderRadius: '8px',
                            padding: '10px',
                            display: 'grid',
                            gap: '10px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                            <div style={{ minWidth: 0 }}>
                              <strong style={{ color: '#f8fafc' }}>{member.name ?? member.email}</strong>
                              <div
                                style={{
                                  color: '#94a3b8',
                                  fontSize: '13px',
                                  overflowWrap: 'anywhere'
                                }}
                              >
                                {member.email}
                              </div>
                            </div>
                            {member.isActiveTenant ? (
                              <span
                                style={{
                                  alignItems: 'center',
                                  color: '#86efac',
                                  display: 'inline-flex',
                                  fontSize: '13px',
                                  fontWeight: 700,
                                  gap: '4px',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                <CheckCircle2 size={14} aria-hidden />
                                Active
                              </span>
                            ) : (
                              <button
                                type="button"
                                style={isMutating ? disabledButtonStyle : subtleButtonStyle}
                                onClick={() => void setActiveTenantForMember(member)}
                                disabled={isMutating}
                                aria-label={`Set ${selectedTenant.name} active for ${member.email}`}
                              >
                                <CheckCircle2 size={16} aria-hidden />
                                Set active
                              </button>
                            )}
                          </div>
                          <div
                            style={{
                              alignItems: 'end',
                              display: 'grid',
                              gap: '8px',
                              gridTemplateColumns: 'minmax(160px, 1fr) auto'
                            }}
                          >
                            <label style={labelStyle}>
                              Tenancy role
                              <select
                                value={member.role}
                                onChange={(event) =>
                                  void updateTenantMemberRole(
                                    member,
                                    event.target.value as TenantMember['role']
                                  )
                                }
                                disabled={isMutating}
                                style={inputStyle}
                                aria-label={`Tenancy role for ${member.email}`}
                              >
                                <option value="MEMBER">Read-only member</option>
                                <option value="OWNER">Owner</option>
                              </select>
                            </label>
                            <button
                              type="button"
                              style={isMutating ? disabledButtonStyle : subtleButtonStyle}
                              onClick={() => void removeTenantMember(member)}
                              disabled={isMutating}
                              aria-label={`Remove ${member.email} from ${selectedTenant.name}`}
                            >
                              <Trash2 size={16} aria-hidden />
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <p style={{ margin: 0, color: '#93c5fd' }}>Select a tenant to inspect members.</p>
            )}
          </aside>
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0, color: '#f8fafc' }}>Provider settings</h2>
        <div style={{ display: 'grid', gap: '14px', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          <label style={labelStyle}>
            Active provider
            <select
              value={settings.activeProvider}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  activeProvider: event.target.value as RuntimeSettings['activeProvider']
                }))
              }
              style={inputStyle}
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="local">Local model</option>
              <option value="stub">Stub</option>
            </select>
          </label>
          <label style={labelStyle}>
            OpenAI model
            <input
              value={settings.openaiModel}
              onChange={(event) =>
                setSettings((current) => ({ ...current, openaiModel: event.target.value }))
              }
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Anthropic model
            <input
              value={settings.anthropicModel}
              onChange={(event) =>
                setSettings((current) => ({ ...current, anthropicModel: event.target.value }))
              }
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Local model label
            <input
              value={settings.localModelName}
              onChange={(event) =>
                setSettings((current) => ({ ...current, localModelName: event.target.value }))
              }
              style={inputStyle}
            />
          </label>
          <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
            ML service URL
            <input
              value={settings.mlServiceUrl}
              onChange={(event) =>
                setSettings((current) => ({ ...current, mlServiceUrl: event.target.value }))
              }
              style={inputStyle}
            />
          </label>
        </div>
        <div style={{ marginTop: '16px' }}>
          <button type="button" style={buttonStyle} onClick={saveSettings} disabled={saving}>
            {saving ? 'Saving...' : 'Save settings'}
          </button>
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0, color: '#f8fafc' }}>Import trained artifact</h2>
        <p style={{ margin: '0 0 14px', color: '#cbd5e1' }}>
          Upload a zip or tar archive with a root manifest.json and model files from your offline
          training run.
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="file"
            accept=".zip,.tar,.tgz,.tar.gz,application/zip,application/gzip"
            onChange={(event) => setArtifactFile(event.target.files?.[0] ?? null)}
            style={inputStyle}
          />
          <button type="button" style={buttonStyle} onClick={importArtifact} disabled={importing}>
            {importing ? 'Importing...' : 'Import artifact'}
          </button>
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0, color: '#f8fafc' }}>Imported model artifacts</h2>
        <div style={{ display: 'grid', gap: '12px' }}>
          {artifacts.length === 0 ? (
            <p style={{ margin: 0, color: '#93c5fd' }}>No imported model artifacts yet.</p>
          ) : (
            artifacts.map((artifact) => (
              <article
                key={artifact.id}
                style={{
                  border: artifact.isActive ? '2px solid #38bdf8' : '1px solid #334155',
                  borderRadius: '14px',
                  padding: '14px',
                  background: artifact.isActive ? '#0b1738' : '#0f172a',
                  boxShadow: artifact.isActive ? '0 0 0 1px rgba(56, 189, 248, 0.16) inset' : 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <strong style={{ color: '#f8fafc' }}>
                      {artifact.name} / {artifact.version}
                    </strong>
                    <p style={{ margin: '6px 0 0', color: '#cbd5e1' }}>
                      {artifact.architecture} {artifact.localPath ? `· ${artifact.localPath}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    style={buttonStyle}
                    onClick={() => activateArtifact(artifact.id)}
                    disabled={saving || artifact.isActive}
                  >
                    {artifact.isActive ? 'Active' : 'Activate'}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {message && (
        <section style={{ ...cardStyle, padding: '14px 18px' }}>
          <p style={{ margin: 0, color: '#dbeafe' }}>{message}</p>
        </section>
      )}
    </div>
  );
}
