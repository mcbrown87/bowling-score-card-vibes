'use client';

import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

const errorMessages: Record<string, string> = {
  OAuthAccountNotLinked:
    'This Google account is not linked to your credentials. Sign in with email/password first or use a different account.',
  Callback: 'Authentication failed. Please try again.'
};

type LoginFormProps = {
  initialError?: string | null;
};

export function LoginForm({ initialError }: LoginFormProps) {
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/';

  const handleGoogleSignIn = () => {
    signIn('google', { callbackUrl });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email')?.toString() ?? '';
    const password = formData.get('password')?.toString() ?? '';

    const result = await signIn('credentials', {
      redirect: false,
      email,
      password,
      callbackUrl
    });

    setIsSubmitting(false);

    if (result?.error) {
      setError('Invalid email or password.');
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <h1>Log In</h1>
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" required placeholder="you@example.com" />

      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" required minLength={8} />

      {error && <p className="auth-error">{error}</p>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign In'}
      </button>

      <div className="auth-links">
        <button type="button" className="google-btn" onClick={handleGoogleSignIn}>
          <span className="google-icon" aria-hidden="true">
            <svg viewBox="0 0 533.5 544.3" xmlns="http://www.w3.org/2000/svg" role="img" focusable="false">
              <path
                d="M533.5 278.4c0-18.3-1.5-36-4.4-53.1H272v100.8h146.9c-6.4 34.4-26.1 63.5-55.5 83v68h89.6c52.4-48.3 80.5-119.4 80.5-198.7z"
                fill="#4285f4"
              />
              <path
                d="M272 544.3c73.7 0 135.6-24.5 180.8-66.3l-89.6-68c-24.9 16.7-56.8 26.5-91.2 26.5-70 0-129.3-47.2-150.5-110.5H29.8v69.4C74.4 486.1 166.7 544.3 272 544.3z"
                fill="#34a853"
              />
              <path
                d="M121.5 325.9c-10.4-30.8-10.4-64 0-94.8V161.7H29.8c-42 83.8-42 182.9 0 266.7l91.7-69.6z"
                fill="#fbbc04"
              />
              <path
                d="M272 107.7c39.9-.6 78.4 14.1 107.7 41.9l80.4-80.4C407.6 24.9 345.7.5 272 0 166.7 0 74.4 58.2 29.8 152.6l91.7 69.5C142.7 154.9 202 107.7 272 107.7z"
                fill="#ea4335"
              />
            </svg>
          </span>
          <span>Sign in with Google</span>
        </button>
      </div>
    </form>
  );
}
