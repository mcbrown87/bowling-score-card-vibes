import Link from 'next/link';

import { AdminConsole } from '@/components/AdminConsole';
import { AppHeader } from '@/components/AppHeader';
import { auth } from '@/server/auth';
import { getRuntimeSettings } from '@/server/config/appConfig';
import { prisma } from '@/server/db/client';
import { getTrainingDatasetCounts } from '@/server/services/localModelArtifacts';

export default async function AdminPage() {
  const session = await auth();

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

  const [settings, artifacts, datasetCounts] = await Promise.all([
    getRuntimeSettings(),
    prisma.modelArtifact.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }]
    }),
    getTrainingDatasetCounts()
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
      />
    </main>
  );
}
