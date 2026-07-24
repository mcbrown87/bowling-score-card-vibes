import Link from 'next/link';

import { AppHeader } from '@/components/AppHeader';
import { PlayerGamesBrowser } from '@/components/PlayerGamesBrowser';
import { auth } from '@/server/auth';
import { getTenantAccessForSession } from '@/server/auth/tenant';

export default async function PlayersPage() {
  const session = await auth();
  const tenantAccess = session?.user ? await getTenantAccessForSession(session) : null;

  if (!session?.user) {
    return (
      <main className="auth-required">
        <div className="auth-card">
          <h1>Welcome to Bowling Scorecard Vibes</h1>
          <p>Sign in or create an account to save your scorecards and unlock personalized features.</p>
          <div className="auth-links">
            <Link href="/login">Log in</Link> · <Link href="/signup">Sign up</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <AppHeader
        userLabel={`Signed in as ${session.user.name ?? session.user.email}`}
        isAdmin={session.user.role === 'ADMIN'}
        canUpload={tenantAccess?.canEdit ?? false}
      />
      <div style={{ padding: '0 16px 16px', maxWidth: '1200px', margin: '0 auto' }}>
        <PlayerGamesBrowser />
      </div>
    </main>
  );
}
