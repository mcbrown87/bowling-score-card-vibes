'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Home, Images, MoreHorizontal, Shield, Users } from 'lucide-react';
import { SignOutButton } from './auth/SignOutButton';

type AppHeaderProps = {
  userLabel: string;
  isAdmin?: boolean;
};

const headerStyles: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  padding: '8px 16px',
  borderBottom: '1px solid #334155',
  background: 'rgba(8, 16, 42, 0.94)',
  backdropFilter: 'blur(18px)',
  position: 'sticky' as const,
  top: 0,
  zIndex: 20
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

const mobileHeaderStyles: CSSProperties = {
  ...headerStyles,
  padding: 'calc(8px + env(safe-area-inset-top)) 14px 10px'
};

const mobileTitleStackStyles: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0
};

const mobileTitleStyles: CSSProperties = {
  fontWeight: 800,
  fontSize: '15px',
  color: '#f8fafc',
  lineHeight: 1.2
};

const mobileSubtitleStyles: CSSProperties = {
  color: '#93c5fd',
  fontSize: '12px',
  lineHeight: 1.3,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '62vw'
};

const mobileBottomNavStyles: CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 30,
  padding: '8px 12px calc(8px + env(safe-area-inset-bottom))',
  background: 'rgba(8, 16, 42, 0.94)',
  borderTop: '1px solid rgba(96, 165, 250, 0.28)',
  backdropFilter: 'blur(18px)',
  boxShadow: '0 -14px 34px rgba(2, 6, 23, 0.42)'
};

const mobileNavInnerStyles: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: '6px',
  maxWidth: '520px',
  margin: '0 auto'
};

const mobileNavItemStyles: CSSProperties = {
  appearance: 'none',
  minHeight: '54px',
  border: '1px solid transparent',
  borderRadius: '14px',
  background: 'transparent',
  color: '#94a3b8',
  textDecoration: 'none',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  fontSize: '11px',
  fontWeight: 800,
  cursor: 'pointer',
  padding: '6px 4px'
};

const mobileNavItemActiveStyles: CSSProperties = {
  ...mobileNavItemStyles,
  color: '#f8fafc',
  background: 'linear-gradient(180deg, rgba(37, 99, 235, 0.52) 0%, rgba(14, 116, 144, 0.34) 100%)',
  border: '1px solid rgba(125, 211, 252, 0.5)',
  boxShadow: 'inset 0 0 0 1px rgba(224, 242, 254, 0.08)'
};

const drawerOverlayStyles: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 40,
  background: 'rgba(2, 6, 23, 0.54)',
  display: 'flex',
  alignItems: 'flex-end'
};

const drawerPanelStyles: CSSProperties = {
  width: '100%',
  padding: '10px 16px calc(18px + env(safe-area-inset-bottom))',
  borderTopLeftRadius: '24px',
  borderTopRightRadius: '24px',
  background: 'linear-gradient(180deg, #0b1738 0%, #08102a 100%)',
  borderTop: '1px solid rgba(125, 211, 252, 0.34)',
  boxShadow: '0 -24px 60px rgba(2, 6, 23, 0.6)'
};

const drawerHandleStyles: CSSProperties = {
  width: '42px',
  height: '5px',
  borderRadius: '999px',
  background: '#475569',
  margin: '0 auto 16px'
};

const drawerHeaderStyles: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
  marginBottom: '14px'
};

const drawerTitleStyles: CSSProperties = {
  margin: 0,
  color: '#f8fafc',
  fontSize: '18px',
  lineHeight: 1.2
};

const drawerUserStyles: CSSProperties = {
  margin: '4px 0 0',
  color: '#93c5fd',
  fontSize: '13px'
};

const drawerCloseStyles: CSSProperties = {
  width: '40px',
  height: '40px',
  borderRadius: '999px',
  border: '1px solid #475569',
  background: '#0f172a',
  color: '#e2e8f0',
  cursor: 'pointer',
  fontSize: '22px',
  lineHeight: 1
};

const drawerListStyles: CSSProperties = {
  display: 'grid',
  gap: '8px',
  marginBottom: '16px'
};

const drawerLinkStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  minHeight: '48px',
  padding: '10px 12px',
  borderRadius: '14px',
  textDecoration: 'none',
  color: '#e2e8f0',
  background: 'rgba(15, 23, 42, 0.72)',
  border: '1px solid #334155',
  fontWeight: 700
};

const drawerLinkActiveStyles: CSSProperties = {
  ...drawerLinkStyles,
  background: '#0f224a',
  border: '1px solid #60a5fa',
  color: '#f8fafc'
};

type NavItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
  active: boolean;
};

export function AppHeader({ userLabel, isAdmin = false }: AppHeaderProps) {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const update = () => {
      setIsMobile(window.innerWidth <= 640);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  useEffect(() => {
    const previousPaddingBottom = document.body.style.paddingBottom;
    if (isMobile) {
      document.body.style.paddingBottom = 'calc(76px + env(safe-area-inset-bottom))';
    } else {
      document.body.style.paddingBottom = previousPaddingBottom;
    }

    return () => {
      document.body.style.paddingBottom = previousPaddingBottom;
    };
  }, [isMobile]);

  const isHome = pathname === '/';
  const isLibrary = pathname?.startsWith('/library');
  const isPlayers = pathname?.startsWith('/players');
  const isAdminRoute = pathname?.startsWith('/admin');

  const primaryNavItems: NavItem[] = [
    { href: '/', label: 'Upload', Icon: Home, active: isHome },
    { href: '/library', label: 'Library', Icon: Images, active: Boolean(isLibrary) },
    { href: '/players', label: 'Players', Icon: Users, active: Boolean(isPlayers) }
  ];

  if (isMobile) {
    return (
      <>
        <header style={mobileHeaderStyles}>
          <div style={topRowStyles}>
            <div style={mobileTitleStackStyles}>
              <span style={mobileTitleStyles}>Bowling Scorecard</span>
              <span style={mobileSubtitleStyles}>{userLabel}</span>
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              style={{
                ...mobileNavItemStyles,
                minHeight: '44px',
                width: '44px',
                borderRadius: '999px',
                border: '1px solid #475569',
                background: '#0f172a',
                padding: 0
              }}
              aria-label="Open navigation menu"
              aria-expanded={drawerOpen}
            >
              <MoreHorizontal size={22} aria-hidden="true" />
            </button>
          </div>
        </header>

        <nav style={mobileBottomNavStyles} aria-label="Primary navigation">
          <div style={mobileNavInnerStyles}>
            {primaryNavItems.map(({ href, label, Icon, active }) => (
              <Link
                key={href}
                href={href}
                style={active ? mobileNavItemActiveStyles : mobileNavItemStyles}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={20} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ))}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              style={drawerOpen || isAdminRoute ? mobileNavItemActiveStyles : mobileNavItemStyles}
              aria-label="Open more navigation"
              aria-expanded={drawerOpen}
            >
              <MoreHorizontal size={20} aria-hidden="true" />
              <span>More</span>
            </button>
          </div>
        </nav>

        {drawerOpen && (
          <div
            style={drawerOverlayStyles}
            role="presentation"
            onClick={() => setDrawerOpen(false)}
          >
            <div
              style={drawerPanelStyles}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
              onClick={(event) => event.stopPropagation()}
            >
              <div style={drawerHandleStyles} aria-hidden="true" />
              <div style={drawerHeaderStyles}>
                <div>
                  <h2 style={drawerTitleStyles}>Menu</h2>
                  <p style={drawerUserStyles}>{userLabel}</p>
                </div>
                <button
                  type="button"
                  style={drawerCloseStyles}
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close navigation menu"
                >
                  ×
                </button>
              </div>

              <div style={drawerListStyles}>
                {primaryNavItems.map(({ href, label, Icon, active }) => (
                  <Link
                    key={`drawer-${href}`}
                    href={href}
                    style={active ? drawerLinkActiveStyles : drawerLinkStyles}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon size={20} aria-hidden="true" />
                    <span>{label}</span>
                  </Link>
                ))}
                {isAdmin && (
                  <Link
                    href="/admin"
                    style={isAdminRoute ? drawerLinkActiveStyles : drawerLinkStyles}
                    aria-current={isAdminRoute ? 'page' : undefined}
                  >
                    <Shield size={20} aria-hidden="true" />
                    <span>Admin</span>
                  </Link>
                )}
              </div>

              <div
                style={{
                  paddingTop: '14px',
                  borderTop: '1px solid #334155',
                  display: 'flex',
                  justifyContent: 'center'
                }}
              >
                <SignOutButton />
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <header style={headerStyles}>
      <div style={topRowStyles}>
        <span style={{ fontWeight: 700, fontSize: '16px', color: '#f8fafc' }}>
          Bowling Scorecard
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#93c5fd', fontSize: '13px' }}>{userLabel}</span>
          <SignOutButton />
        </div>
      </div>
      <div style={navGroupStyles}>
        <Link href="/" style={isHome ? activeLinkStyles : linkStyles}>
          Upload
        </Link>
        <Link href="/library" style={isLibrary ? activeLinkStyles : linkStyles}>
          Library
        </Link>
        <Link href="/players" style={isPlayers ? activeLinkStyles : linkStyles}>
          Players
        </Link>
        {isAdmin && (
          <Link href="/admin" style={isAdminRoute ? activeLinkStyles : linkStyles}>
            Admin
          </Link>
        )}
      </div>
    </header>
  );
}
