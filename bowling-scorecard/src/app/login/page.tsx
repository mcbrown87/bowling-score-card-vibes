import Link from 'next/link';

import { redirect } from 'next/navigation';

import { LoginForm } from '@/components/auth/LoginForm';
import { auth } from '@/server/auth';

type LoginPageProps = {
  searchParams?: {
    error?: string;
  };
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();

  if (session?.user) {
    redirect('/');
  }

  const friendlyError =
    searchParams?.error === 'OAuthAccountNotLinked'
      ? 'This Google account is not linked to an existing user. Sign in with email/password first (same email) or try a different Google account.'
      : searchParams?.error === 'Callback'
        ? 'Authentication failed. Please try again.'
        : null;

  return (
    <main className="auth-page">
      <div>
        <LoginForm initialError={friendlyError} />
        <p className="auth-links">
          Need an account? <Link href="/signup">Sign up</Link>
        </p>
      </div>
    </main>
  );
}
