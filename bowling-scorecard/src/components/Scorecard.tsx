import React, { useMemo } from 'react';
import { Game } from '../types/bowling';
import { FrameBox } from './FrameBox';
import { formatFrameDisplay, formatTenthFrameDisplay } from '../utils/displayHelpers';

interface ScorecardProps {
  game: Game;
  onFrameSelect?: (frameIndex: number) => void;
  onPlayerNameClick?: () => void;
  disableEditing?: boolean;
  compact?: boolean;
}

const containerStyles: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '12px'
};

const cardStyles: React.CSSProperties = {
  background: 'linear-gradient(180deg, #0b1738 0%, #08102a 100%)',
  borderRadius: '16px',
  border: '1px solid #334155',
  boxShadow: '0 16px 36px rgba(2, 6, 23, 0.4)',
  padding: '24px'
};

const headerStyles: React.CSSProperties = {
  marginBottom: '16px',
  textAlign: 'center'
};

const titleStyles: React.CSSProperties = {
  fontSize: '28px',
  fontWeight: 'bold',
  color: '#f8fafc',
  marginBottom: '8px'
};

const playerNameStyles: React.CSSProperties = {
  fontSize: '18px',
  color: '#cbd5e1'
};

const playerNameButtonStyles: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#7dd3fc',
  fontSize: '18px',
  fontWeight: 600,
  cursor: 'pointer',
  padding: 0
};

const baseFramesGridStyles: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(10, 1fr)',
  gap: '8px',
  marginBottom: '16px'
};

const framesScrollContainerStyles: React.CSSProperties = {
  width: '100%',
  overflowX: 'hidden',
  padding: '0',
  WebkitOverflowScrolling: 'touch'
};

const frameWrapperBaseStyles: React.CSSProperties = {
  position: 'relative',
  borderRadius: '12px',
  padding: '2px',
  backgroundColor: 'rgba(15, 23, 42, 0.45)'
};

const frameButtonStyles: React.CSSProperties = {
  background: 'none',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'transparent',
  borderRadius: '12px',
  padding: 0,
  cursor: 'pointer',
  transition: 'transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease'
};

const frameButtonDisabledStyles: React.CSSProperties = {
  ...frameButtonStyles,
  cursor: 'default',
  opacity: 0.64
};

const playerFooterStyles: React.CSSProperties = {
  marginTop: '12px',
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#93c5fd',
  textAlign: 'center'
};

const playerFooterButtonStyles: React.CSSProperties = {
  ...playerFooterStyles,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  width: '100%',
  padding: 0
};

export const Scorecard: React.FC<ScorecardProps> = ({
  game,
  onFrameSelect,
  onPlayerNameClick,
  disableEditing,
  compact = false
}) => {
  const gridStyles = useMemo<React.CSSProperties>(
    () => ({
      ...baseFramesGridStyles,
      gap: compact ? '10px' : baseFramesGridStyles.gap,
      marginBottom: compact ? '12px' : baseFramesGridStyles.marginBottom,
      gridTemplateColumns: compact
        ? 'repeat(5, minmax(70px, 1fr))'
        : baseFramesGridStyles.gridTemplateColumns
    }),
    [compact]
  );

  const renderFrame = (frameNumber: number, content: React.ReactNode, frameIndex: number) => {
    const wrapper = (
      <div style={frameWrapperBaseStyles}>
        {content}
      </div>
    );

    if (!onFrameSelect) {
      return wrapper;
    }

    const buttonStyles = disableEditing ? frameButtonDisabledStyles : frameButtonStyles;

    return (
      <button
        type="button"
        key={`frame-button-${frameNumber}`}
        onClick={() => {
          if (!disableEditing) {
            onFrameSelect(frameIndex);
          }
        }}
        style={{
          ...buttonStyles,
          opacity: disableEditing ? 0.7 : 1,
          boxShadow: disableEditing ? 'none' : '0 8px 20px rgba(2, 6, 23, 0.38)',
          borderColor: disableEditing ? 'transparent' : '#60a5fa'
        }}
        aria-label={`Edit frame ${frameNumber}`}
      >
        {wrapper}
      </button>
    );
  };

  const containerStyle = useMemo<React.CSSProperties>(
    () => ({
      ...containerStyles,
      padding: compact ? '0' : containerStyles.padding,
      maxWidth: compact ? '100%' : containerStyles.maxWidth
    }),
    [compact]
  );

  const cardStyle = useMemo<React.CSSProperties>(
    () => ({
      ...cardStyles,
      padding: compact ? '12px' : cardStyles.padding,
      borderRadius: compact ? '12px' : cardStyles.borderRadius,
      boxShadow: compact ? '0 10px 24px rgba(2, 6, 23, 0.35)' : cardStyles.boxShadow
    }),
    [compact]
  );

  const titleStyle = useMemo<React.CSSProperties>(
    () => ({
      ...titleStyles,
      fontSize: compact ? '18px' : titleStyles.fontSize,
      marginBottom: compact ? '4px' : titleStyles.marginBottom
    }),
    [compact]
  );

  const playerLabelStyle = useMemo<React.CSSProperties>(
    () => ({
      ...playerNameStyles,
      fontSize: compact ? '14px' : playerNameStyles.fontSize
    }),
    [compact]
  );

  const playerButtonStyle = useMemo<React.CSSProperties>(
    () => ({
      ...playerNameButtonStyles,
      fontSize: compact ? '14px' : playerNameButtonStyles.fontSize
    }),
    [compact]
  );

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {!compact && (
          <div style={headerStyles}>
            <h1 style={titleStyle}>Bowling Scorecard</h1>
            {onPlayerNameClick ? (
              <button
                type="button"
                style={playerButtonStyle}
                onClick={onPlayerNameClick}
                disabled={disableEditing}
              >
                {game.playerName}
              </button>
            ) : (
              <h2 style={playerLabelStyle}>{game.playerName}</h2>
            )}
          </div>
        )}

        {compact ? (
          <div style={framesScrollContainerStyles}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                gap: '8px'
              }}
            >
              {game.frames.slice(0, 9).map((frame, idx) => {
                const frameNumber = idx + 1;
                return renderFrame(
                  frameNumber,
                  <FrameBox
                    frameNumber={frameNumber}
                    frameDisplay={formatFrameDisplay(frame, frameNumber)}
                    compact
                  />,
                  idx
                );
              })}
              {renderFrame(
                10,
                <FrameBox
                  frameNumber={10}
                  frameDisplay={formatTenthFrameDisplay(game.tenthFrame)}
                  isTenthFrame
                  compact
                />,
                9
              )}
            </div>
          </div>
        ) : (
          <div style={gridStyles}>
            {game.frames.map((frame, index) => {
              const frameNumber = index + 1;
              return renderFrame(
                frameNumber,
                <FrameBox
                  frameNumber={frameNumber}
                  frameDisplay={formatFrameDisplay(frame, frameNumber)}
                  compact={compact}
                />,
                index
              );
            })}
            {renderFrame(
              10,
              <FrameBox
                frameNumber={10}
                frameDisplay={formatTenthFrameDisplay(game.tenthFrame)}
                isTenthFrame={true}
                compact={compact}
              />,
              9
            )}
          </div>
        )}

        {onPlayerNameClick ? (
          <button
            type="button"
            style={{
              ...playerFooterButtonStyles,
              opacity: disableEditing ? 0.6 : 1,
              cursor: disableEditing ? 'not-allowed' : 'pointer'
            }}
            onClick={() => {
              if (!disableEditing) {
                onPlayerNameClick();
              }
            }}
            aria-label="Edit player name"
            disabled={disableEditing}
          >
            {game.playerName}
          </button>
        ) : (
          <div style={playerFooterStyles}>{game.playerName}</div>
        )}
      </div>
    </div>
  );
};
