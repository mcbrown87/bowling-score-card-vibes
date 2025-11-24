'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SignOutButton } from './auth/SignOutButton';

type AppHeaderProps = {
  userLabel: string;
};

const navStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 24px',
  borderBottom: '1px solid #e2e8f0',
  backgroundColor: '#ffffff',
  position: 'sticky' as const,
  top: 0,
  zIndex: 10
};

const navGroupStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
  flexWrap: 'wrap'
};

const linkStyles = {
  textDecoration: 'none',
  padding: '8px 12px',
  borderRadius: '8px',
  fontWeight: 600,
  color: '#0f172a'
};

const activeLinkStyles = {
  ...linkStyles,
  backgroundColor: '#e2e8f0'
};

export function AppHeader({ userLabel }: AppHeaderProps) {
  const pathname = usePathname();

  const isHome = pathname === '/';
  const isLibrary = pathname?.startsWith('/library');

  return (
    <header style={navStyles}>
      <div style={navGroupStyles}>
        <Link href="/" style={isHome ? activeLinkStyles : linkStyles}>
          Upload
        </Link>
        <Link href="/library" style={isLibrary ? activeLinkStyles : linkStyles}>
          Library
        </Link>
      </div>
      <div style={navGroupStyles}>
        <span style={{ color: '#475569', fontSize: '14px' }}>{userLabel}</span>
        <SignOutButton />
      </div>
    </header>
  );
}
