'use client';

import { signOut } from 'next-auth/react';

export function SignOutButton() {
  const handleClick = () => {
    signOut({ callbackUrl: '/login' });
  };

  return (
    <button type="button" onClick={handleClick} className="auth-link">
      Sign Out
    </button>
  );
}
