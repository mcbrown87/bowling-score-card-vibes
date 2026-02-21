import React, { useState } from 'react';

interface PlayerNameModalProps {
  initialName: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}

const overlayStyles: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '16px',
  zIndex: 9999
};

const modalStyles: React.CSSProperties = {
  width: '100%',
  maxWidth: '360px',
  background: 'linear-gradient(180deg, #0b1738 0%, #08102a 100%)',
  border: '1px solid #334155',
  borderRadius: '16px',
  padding: '24px',
  boxShadow: '0 20px 40px rgba(2, 6, 23, 0.55)',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px'
};

const titleStyles: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#f8fafc'
};

const inputStyles: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #475569',
  fontSize: '16px',
  backgroundColor: '#0f172a',
  color: '#f8fafc'
};

const actionsRowStyles: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '12px'
};

const buttonBase: React.CSSProperties = {
  border: 'none',
  borderRadius: '8px',
  padding: '10px 18px',
  fontSize: '16px',
  fontWeight: 600,
  cursor: 'pointer'
};

const secondaryButtonStyles: React.CSSProperties = {
  ...buttonBase,
  backgroundColor: '#334155',
  color: '#f8fafc'
};

const primaryButtonStyles: React.CSSProperties = {
  ...buttonBase,
  backgroundColor: '#1d4ed8',
  color: '#fff'
};

export const PlayerNameModal: React.FC<PlayerNameModalProps> = ({ initialName, onSave, onCancel }) => {
  const [name, setName] = useState(initialName);

  return (
    <div style={overlayStyles}>
      <div style={modalStyles} role="dialog" aria-modal="true" aria-label="Edit player name">
        <div>
          <div style={titleStyles}>Edit player name</div>
          <p style={{ fontSize: '14px', color: '#93c5fd', marginTop: '4px' }}>
            This name appears above the scorecard and in review summaries.
          </p>
        </div>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          style={inputStyles}
          placeholder="Player name"
        />
        <div style={actionsRowStyles}>
          <button type="button" style={secondaryButtonStyles} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            style={primaryButtonStyles}
            onClick={() => onSave(name.trim() || 'Player')}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
