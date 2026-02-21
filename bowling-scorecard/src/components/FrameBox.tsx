import React from 'react';
import { FrameDisplay } from '../types/bowling';

interface FrameBoxProps {
  frameNumber: number;
  frameDisplay: FrameDisplay;
  isTenthFrame?: boolean;
  compact?: boolean;
}

const frameBoxStyles: React.CSSProperties = {
  border: '1px solid #93c5fd',
  borderRadius: '10px',
  backgroundColor: '#0b1738',
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  height: '90px',
  overflow: 'hidden',
  boxShadow: '0 8px 18px rgba(2, 6, 23, 0.35), inset 0 0 0 1px rgba(148, 163, 184, 0.24)'
};

const frameHeaderStyles: React.CSSProperties = {
  backgroundColor: '#0f224a',
  textAlign: 'center',
  padding: '4px',
  fontSize: '12px',
  fontWeight: 700,
  color: '#cbd5e1',
  borderBottom: '1px solid #93c5fd',
  letterSpacing: '0.08em'
};

const rollsContainerStyles: React.CSSProperties = {
  flex: 1,
  display: 'flex'
};

const rollBoxStyles: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '20px',
  fontWeight: 800,
  color: '#f8fafc',
  fontFamily: "'Courier New', monospace"
};

const rollBox2Styles: React.CSSProperties = {
  width: '30px',
  borderLeft: '1px solid #93c5fd',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '20px',
  fontWeight: 800,
  color: '#f8fafc',
  fontFamily: "'Courier New', monospace"
};

const tenthFrameRollStyles: React.CSSProperties = {
  flex: 1,
  borderRight: '1px solid #93c5fd',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '20px',
  fontWeight: 800,
  color: '#f8fafc',
  fontFamily: "'Courier New', monospace"
};

const scoreBoxStyles: React.CSSProperties = {
  borderTop: '1px solid #93c5fd',
  height: '30px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(180deg, #08122f 0%, #050b1c 100%)',
  fontWeight: 800,
  fontSize: '16px',
  color: '#e2e8f0',
  fontFamily: "'Courier New', monospace"
};

export const FrameBox: React.FC<FrameBoxProps> = ({
  frameNumber,
  frameDisplay,
  isTenthFrame = false,
  compact = false
}) => {
  const containerStyles = compact
    ? { ...frameBoxStyles, height: '78px' }
    : frameBoxStyles;

  const headerStyles = compact
    ? { ...frameHeaderStyles, fontSize: '10px', padding: '3px' }
    : frameHeaderStyles;

  const primaryRollStyles = compact
    ? { ...rollBoxStyles, fontSize: '16px' }
    : rollBoxStyles;

  const secondaryRollStyles = compact
    ? { ...rollBox2Styles, fontSize: '16px', width: '26px' }
    : rollBox2Styles;

  const tenthRollStyles = compact
    ? { ...tenthFrameRollStyles, fontSize: '16px' }
    : tenthFrameRollStyles;

  const totalStyles = compact
    ? { ...scoreBoxStyles, fontSize: '13px', height: '24px' }
    : scoreBoxStyles;

  return (
    <div style={containerStyles}>
      <div style={headerStyles}>
        {frameNumber}
      </div>

      <div style={rollsContainerStyles}>
        <div style={{ flex: 1, display: 'flex' }}>
          {isTenthFrame ? (
            <div style={{ display: 'flex', flex: 1 }}>
              <div style={tenthRollStyles}>
                {frameDisplay.roll1}
              </div>
              <div style={tenthRollStyles}>
                {frameDisplay.roll2}
              </div>
              <div style={{ ...tenthRollStyles, borderRight: 'none' }}>
                {frameDisplay.roll3}
              </div>
            </div>
          ) : (
            <>
              <div style={primaryRollStyles}>
                {frameDisplay.roll1}
              </div>
              <div style={secondaryRollStyles}>
                {frameDisplay.roll2}
              </div>
            </>
          )}
        </div>
      </div>

      <div style={totalStyles}>
        {frameDisplay.frameScore !== null ? frameDisplay.frameScore : ''}
      </div>
    </div>
  );
};
