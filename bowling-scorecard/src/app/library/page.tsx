import Link from 'next/link';

import { AppHeader } from '@/components/AppHeader';
import { StoredImagesLibrary } from '@/components/StoredImagesLibrary';
import { auth } from '@/server/auth';

export default async function LibraryPage() {
  const session = await auth();

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
      <AppHeader userLabel={`Signed in as ${session.user.name ?? session.user.email}`} />
      <div style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto' }}>
        <StoredImagesLibrary />
      </div>
    </main>
  );
}
