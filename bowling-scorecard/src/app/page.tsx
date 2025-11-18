import Link from 'next/link';

import BowlingApp from '@/components/BowlingApp';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { auth } from '@/server/auth';

export default async function HomePage() {
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
      <section style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p>Signed in as {session.user.name ?? session.user.email}</p>
        <SignOutButton />
      </section>
      <BowlingApp />
    </main>
  );
}
