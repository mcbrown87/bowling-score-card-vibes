import Link from 'next/link';

import { AdminConsole } from '@/components/AdminConsole';
import { AppHeader } from '@/components/AppHeader';
import { auth } from '@/server/auth';
import { getTenantAccessForSession } from '@/server/auth/tenant';
import { getRuntimeSettings } from '@/server/config/appConfig';
import { prisma } from '@/server/db/client';
import { getTrainingDatasetCounts } from '@/server/services/localModelArtifacts';

export default async function AdminPage() {
  const session = await auth();
  const tenantAccess = session?.user ? await getTenantAccessForSession(session) : null;

  if (!session?.user) {
    return (
      <main className="auth-required">
        <div className="auth-card">
          <h1>Welcome to Bowling Scorecard Vibes</h1>
          <p>Sign in or create an account to access admin controls.</p>
          <div className="auth-links">
            <Link href="/login">Log in</Link> · <Link href="/signup">Sign up</Link>
          </div>
        </div>
      </main>
    );
  }

  if (session.user.role !== 'ADMIN') {
    return (
      <main>
        <AppHeader
          userLabel={`Signed in as ${session.user.name ?? session.user.email}`}
          isAdmin={false}
          canUpload={tenantAccess?.canEdit ?? false}
        />
        <div style={{ maxWidth: '880px', margin: '0 auto', padding: '40px 16px' }}>
          <div
            style={{
              borderRadius: '24px',
              padding: '32px',
              background: 'linear-gradient(180deg, #0b1738 0%, #08102a 100%)',
              border: '1px solid #334155',
              boxShadow: '0 18px 36px rgba(2, 6, 23, 0.45)'
            }}
          >
            <h1 style={{ marginTop: 0, color: '#f8fafc' }}>Admin access required</h1>
            <p style={{ marginBottom: 0, color: '#93c5fd' }}>
              Your account is signed in, but it does not have the `ADMIN` role.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const [settings, artifacts, datasetCounts, tenants, users] = await Promise.all([
    getRuntimeSettings(),
    prisma.modelArtifact.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }]
    }),
    getTrainingDatasetCounts(),
    prisma.tenant.findMany({
      orderBy: [{ createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        createdAt: true,
        memberships: {
          orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
          select: {
            role: true,
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                activeTenantId: true
              }
            }
          }
        },
        _count: {
          select: {
            storedImages: true,
            players: true,
            bowlingTeams: true
          }
        }
      }
    }),
    prisma.user.findMany({
      orderBy: [{ email: 'asc' }],
      select: {
        id: true,
        email: true,
        name: true
      }
    })
  ]);

  return (
    <main
      style={{
        minHeight: '100vh'
      }}
    >
      <AppHeader
        userLabel={`Signed in as ${session.user.name ?? session.user.email}`}
        isAdmin
        canUpload={tenantAccess?.canEdit ?? false}
      />
      <AdminConsole
        initialSettings={settings}
        initialArtifacts={artifacts.map((artifact) => ({
          ...artifact,
          metrics:
            artifact.metrics && typeof artifact.metrics === 'object' && !Array.isArray(artifact.metrics)
              ? (artifact.metrics as Record<string, unknown>)
              : null
        }))}
        datasetCounts={datasetCounts}
        initialUsers={users}
        initialTenants={tenants.map((tenant) => ({
          id: tenant.id,
          name: tenant.name,
          createdAt: tenant.createdAt.toISOString(),
          imageCount: tenant._count.storedImages,
          playerCount: tenant._count.players,
          teamCount: tenant._count.bowlingTeams,
          members: tenant.memberships.map((membership) => ({
            userId: membership.user.id,
            email: membership.user.email,
            name: membership.user.name,
            role: membership.role,
            isActiveTenant: membership.user.activeTenantId === tenant.id
          }))
        }))}
      />
    </main>
  );
}
