'use client';

import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      name: formData.get('name')?.toString() ?? '',
      email: formData.get('email')?.toString() ?? '',
      password: formData.get('password')?.toString() ?? ''
    };

    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data?.error ?? 'Unable to create account.');
      setIsSubmitting(false);
      return;
    }

    const result = await signIn('credentials', {
      redirect: false,
      email: payload.email,
      password: payload.password
    });

    setIsSubmitting(false);

    if (result?.error) {
      setError('Unable to sign in with the new account.');
      return;
    }

    router.push('/');
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <h1>Create Account</h1>
      <label htmlFor="name">Name</label>
      <input id="name" name="name" type="text" required />

      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" required placeholder="you@example.com" />

      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" required minLength={8} />

      {error && <p className="auth-error">{error}</p>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating account…' : 'Sign Up'}
      </button>
    </form>
  );
}
