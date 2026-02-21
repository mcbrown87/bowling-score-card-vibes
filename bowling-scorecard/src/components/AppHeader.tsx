'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { SignOutButton } from './auth/SignOutButton';

type AppHeaderProps = {
  userLabel: string;
};

const headerStyles: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  padding: '8px 16px',
  borderBottom: '1px solid #334155',
  background: 'linear-gradient(180deg, #0b1738 0%, #08102a 100%)',
  position: 'sticky' as const,
  top: 0,
  zIndex: 10
};

const topRowStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px'
};

const navGroupStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  flexWrap: 'wrap' as CSSProperties['flexWrap']
};

const linkStyles = {
  textDecoration: 'none',
  padding: '8px 12px',
  borderRadius: '8px',
  fontWeight: 600,
  color: '#cbd5e1',
  border: '1px solid transparent'
};

const activeLinkStyles = {
  ...linkStyles,
  backgroundColor: '#0f224a',
  border: '1px solid #60a5fa',
  color: '#f8fafc'
};

export function AppHeader({ userLabel }: AppHeaderProps) {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const update = () => {
      setIsMobile(window.innerWidth <= 480);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const isHome = pathname === '/';
  const isLibrary = pathname?.startsWith('/library');
  const isPlayers = pathname?.startsWith('/players');

  return (
    <header style={headerStyles}>
      <div style={topRowStyles}>
        <span style={{ fontWeight: 700, fontSize: '16px', color: '#f8fafc' }}>
          Bowling Scorecard
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!isMobile && <span style={{ color: '#93c5fd', fontSize: '13px' }}>{userLabel}</span>}
          <SignOutButton />
          {isMobile && (
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              style={{
                border: '1px solid #475569',
                backgroundColor: '#0f172a',
                color: '#e2e8f0',
                borderRadius: '6px',
                padding: '4px 10px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
              aria-label="Toggle navigation menu"
            >
              Menu
            </button>
          )}
        </div>
      </div>
      {(!isMobile || menuOpen) && (
        <div
          style={{
            ...navGroupStyles,
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'flex-start' : 'center'
          }}
        >
          {isMobile && (
            <span style={{ color: '#93c5fd', fontSize: '13px' }}>{userLabel}</span>
          )}
          <Link href="/" style={isHome ? activeLinkStyles : linkStyles}>
            Upload
          </Link>
          <Link href="/library" style={isLibrary ? activeLinkStyles : linkStyles}>
            Library
          </Link>
          <Link href="/players" style={isPlayers ? activeLinkStyles : linkStyles}>
            Players
          </Link>
        </div>
      )}
    </header>
  );
}
