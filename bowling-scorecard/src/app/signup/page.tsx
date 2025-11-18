import Link from 'next/link';

import { redirect } from 'next/navigation';

import { SignupForm } from '@/components/auth/SignupForm';
import { auth } from '@/server/auth';

export default async function SignupPage() {
  const session = await auth();

  if (session?.user) {
    redirect('/');
  }

  return (
    <main className="auth-page">
      <div>
        <SignupForm />
        <p className="auth-links">
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </div>
    </main>
  );
}
