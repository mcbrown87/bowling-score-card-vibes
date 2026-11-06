'use client';

import { Trophy } from 'lucide-react';
import type { CSSProperties } from 'react';

type LeagueGameSwitchProps = {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  compact?: boolean;
};

const controlStyles: CSSProperties = {
  width: '100%',
  minHeight: '52px',
  padding: '8px 10px',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  borderRadius: '14px',
  border: '1px solid #475569',
  color: '#e2e8f0',
  textAlign: 'left',
  transition: 'border-color 160ms ease, background-color 160ms ease, opacity 160ms ease'
};

const iconStyles: CSSProperties = {
  width: '34px',
  height: '34px',
  flex: '0 0 34px',
  display: 'grid',
  placeItems: 'center',
  borderRadius: '10px'
};

const trackStyles: CSSProperties = {
  width: '44px',
  height: '26px',
  padding: '3px',
  flex: '0 0 44px',
  borderRadius: '999px',
  display: 'flex',
  alignItems: 'center',
  transition: 'background-color 160ms ease'
};

const thumbStyles: CSSProperties = {
  width: '20px',
  height: '20px',
  borderRadius: '50%',
  backgroundColor: '#ffffff',
  boxShadow: '0 2px 5px rgba(2, 6, 23, 0.35)',
  transition: 'transform 160ms ease'
};

export function LeagueGameSwitch({
  checked,
  disabled = false,
  onChange,
  compact = false
}: LeagueGameSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="League game"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        ...controlStyles,
        maxWidth: compact ? '260px' : '320px',
        backgroundColor: checked ? 'rgba(30, 64, 175, 0.35)' : 'rgba(15, 23, 42, 0.75)',
        borderColor: checked ? '#60a5fa' : '#475569',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1
      }}
    >
      <span
        aria-hidden="true"
        style={{
          ...iconStyles,
          color: checked ? '#dbeafe' : '#94a3b8',
          backgroundColor: checked ? '#1d4ed8' : '#1e293b'
        }}
      >
        <Trophy size={18} strokeWidth={2.25} />
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: '14px', fontWeight: 800 }}>League game</span>
        <span style={{ display: 'block', marginTop: '1px', fontSize: '11px', color: '#93c5fd' }}>
          2 teams · 8 scores
        </span>
      </span>
      <span
        aria-hidden="true"
        style={{
          ...trackStyles,
          backgroundColor: checked ? '#2563eb' : '#475569'
        }}
      >
        <span
          style={{
            ...thumbStyles,
            transform: checked ? 'translateX(18px)' : 'translateX(0)'
          }}
        />
      </span>
    </button>
  );
}
