import React from 'react';
import { FrameDisplay } from '../types/bowling';

interface FrameBoxProps {
  frameNumber: number;
  frameDisplay: FrameDisplay;
  isTenthFrame?: boolean;
  compact?: boolean;
}

const frameBoxStyles: React.CSSProperties = {
  border: '2px solid black',
  backgroundColor: 'white',
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  height: '80px'
};

const frameHeaderStyles: React.CSSProperties = {
  backgroundColor: '#f5f5f5',
  textAlign: 'center',
  padding: '4px',
  fontSize: '12px',
  fontWeight: 'bold',
  borderBottom: '1px solid black'
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
  fontSize: '16px',
  fontWeight: 'bold'
};

const rollBox2Styles: React.CSSProperties = {
  width: '24px',
  borderLeft: '1px solid black',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '16px',
  fontWeight: 'bold'
};

const tenthFrameRollStyles: React.CSSProperties = {
  flex: 1,
  borderRight: '1px solid black',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '16px',
  fontWeight: 'bold'
};

const scoreBoxStyles: React.CSSProperties = {
  borderTop: '1px solid black',
  height: '26px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#fffbf0',
  fontWeight: 'bold',
  fontSize: '14px'
};

export const FrameBox: React.FC<FrameBoxProps> = ({
  frameNumber,
  frameDisplay,
  isTenthFrame = false,
  compact = false
}) => {
  const containerStyles = compact
    ? { ...frameBoxStyles, height: '68px', borderWidth: '1px' }
    : frameBoxStyles;

  const headerStyles = compact
    ? { ...frameHeaderStyles, fontSize: '11px', padding: '3px' }
    : frameHeaderStyles;

  const primaryRollStyles = compact
    ? { ...rollBoxStyles, fontSize: '14px' }
    : rollBoxStyles;

  const secondaryRollStyles = compact
    ? { ...rollBox2Styles, fontSize: '14px' }
    : rollBox2Styles;

  const tenthRollStyles = compact
    ? { ...tenthFrameRollStyles, fontSize: '14px' }
    : tenthFrameRollStyles;

  const totalStyles = compact
    ? { ...scoreBoxStyles, fontSize: '12px', height: '22px' }
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
