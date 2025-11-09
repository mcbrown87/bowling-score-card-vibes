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
  backgroundColor: '#f8fafc',
  borderRadius: '16px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 12px 24px rgba(15, 23, 42, 0.08)',
  padding: '24px'
};

const headerStyles: React.CSSProperties = {
  marginBottom: '16px',
  textAlign: 'center'
};

const titleStyles: React.CSSProperties = {
  fontSize: '28px',
  fontWeight: 'bold',
  color: '#333',
  marginBottom: '8px'
};

const playerNameStyles: React.CSSProperties = {
  fontSize: '18px',
  color: '#666'
};

const playerNameButtonStyles: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#2563eb',
  fontSize: '18px',
  fontWeight: 600,
  cursor: 'pointer',
  padding: 0
};

const baseFramesGridStyles: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(10, 1fr)',
  gap: '6px',
  marginBottom: '16px'
};

const frameWrapperBaseStyles: React.CSSProperties = {
  position: 'relative',
  borderRadius: '10px',
  padding: '3px',
  backgroundColor: '#fff'
};

const frameButtonStyles: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer'
};

const frameButtonDisabledStyles: React.CSSProperties = {
  ...frameButtonStyles,
  cursor: 'default'
};

const issueBadgeStyles: React.CSSProperties = {
  position: 'absolute',
  top: '-8px',
  right: '-8px',
  backgroundColor: '#dc2626',
  color: 'white',
  borderRadius: '9999px',
  width: '20px',
  height: '20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '12px',
  fontWeight: 700,
  boxShadow: '0 1px 3px rgba(0,0,0,0.25)'
};

const lowConfidenceBadgeStyles: React.CSSProperties = {
  ...issueBadgeStyles,
  backgroundColor: '#f97316'
};

const totalScoreStyles: React.CSSProperties = {
  textAlign: 'center'
};

const scoreTextStyles: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#2563eb'
};

const perfectGameStyles: React.CSSProperties = {
  fontSize: '18px',
  color: '#f59e0b',
  fontWeight: 'bold',
  marginTop: '8px'
};

const confidenceStyles: React.CSSProperties = {
  marginTop: '8px',
  fontSize: '16px',
  fontWeight: 'bold'
};

const issuesContainerStyles: React.CSSProperties = {
  marginTop: '12px',
  fontSize: '14px',
  color: '#9a3412',
  backgroundColor: '#fff7ed',
  borderRadius: '8px',
  padding: '8px 12px',
  border: '1px solid #fdba74'
};

const helperTextStyles: React.CSSProperties = {
  marginTop: '8px',
  fontSize: '13px',
  color: '#64748b',
  textAlign: 'center'
};

export const Scorecard: React.FC<ScorecardProps> = ({
  game,
  onFrameSelect,
  onPlayerNameClick,
  disableEditing,
  compact = false
}) => {
  const confidencePercent =
    typeof game.confidence === 'number' ? Math.round(game.confidence * 100) : null;
  const confidenceColor =
    confidencePercent !== null && confidencePercent < 70 ? '#dc2626' : '#059669';
  const lowConfidence = confidencePercent !== null && confidencePercent < 70;

  const { frameIssues, generalIssues } = useMemo(() => {
    const map = new Map<number, string[]>();
    const general: string[] = [];

    (game.issues ?? []).forEach((issue) => {
      const framesForIssue = new Set<number>();

      const directRegex = /frame\s+(\d+)/gi;
      let match: RegExpExecArray | null;
      while ((match = directRegex.exec(issue)) !== null) {
        const frameNum = Number(match[1]);
        if (Number.isFinite(frameNum) && frameNum >= 1 && frameNum <= 10) {
          framesForIssue.add(frameNum);
        }
      }

      const rangeRegex = /frames?\s+(\d+)\s+(?:and|-)\s+(\d+)/gi;
      while ((match = rangeRegex.exec(issue)) !== null) {
        const first = Number(match[1]);
        const second = Number(match[2]);
        if (Number.isFinite(first) && first >= 1 && first <= 10) {
          framesForIssue.add(first);
        }
        if (Number.isFinite(second) && second >= 1 && second <= 10) {
          framesForIssue.add(second);
        }
      }

      if (framesForIssue.size === 0) {
        general.push(issue);
      } else {
        framesForIssue.forEach((frameNumber) => {
          const existing = map.get(frameNumber) ?? [];
          map.set(frameNumber, [...existing, issue]);
        });
      }
    });

    return { frameIssues: map, generalIssues: general };
  }, [game.issues]);

  const gridStyles = useMemo<React.CSSProperties>(
    () => ({
      ...baseFramesGridStyles,
      gridTemplateColumns: compact ? 'repeat(5, minmax(70px, 1fr))' : baseFramesGridStyles.gridTemplateColumns,
      gap: compact ? '10px' : baseFramesGridStyles.gap,
      marginBottom: compact ? '12px' : baseFramesGridStyles.marginBottom
    }),
    [compact]
  );

  const renderFrame = (
    frameNumber: number,
    content: React.ReactNode,
    issuesForFrame: string[] | undefined,
    frameIndex: number
  ) => {
    const hasIssues = Boolean(issuesForFrame && issuesForFrame.length > 0);
    const outlineColor = hasIssues ? '#dc2626' : lowConfidence ? '#f97316' : 'transparent';
    const backgroundColor = hasIssues ? '#fee2e2' : lowConfidence ? '#fff7ed' : 'transparent';
    const tooltipMessages = hasIssues
      ? issuesForFrame?.join('\n')
      : lowConfidence
      ? 'Low confidence result'
      : undefined;

    const wrapper = (
      <div
        style={{
          ...frameWrapperBaseStyles,
          outline: outlineColor !== 'transparent' ? `2px solid ${outlineColor}` : 'none',
          backgroundColor
        }}
        title={tooltipMessages}
      >
        {content}
        {hasIssues && <span style={issueBadgeStyles}>⚠︎</span>}
        {!hasIssues && lowConfidence && <span style={lowConfidenceBadgeStyles}>?</span>}
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
          opacity: disableEditing ? 0.7 : 1
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
      padding: compact ? '8px' : containerStyles.padding
    }),
    [compact]
  );

  const cardStyle = useMemo<React.CSSProperties>(
    () => ({
      ...cardStyles,
      padding: compact ? '16px' : cardStyles.padding,
      borderRadius: compact ? '12px' : cardStyles.borderRadius
    }),
    [compact]
  );

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={headerStyles}>
          <h1 style={titleStyles}>Bowling Scorecard</h1>
          {onPlayerNameClick ? (
            <button
              type="button"
              style={playerNameButtonStyles}
              onClick={onPlayerNameClick}
              disabled={disableEditing}
            >
              {game.playerName}
            </button>
          ) : (
            <h2 style={playerNameStyles}>{game.playerName}</h2>
          )}
        </div>
        
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
              frameIssues.get(frameNumber),
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
            frameIssues.get(10),
            9
          )}
        </div>

        {onFrameSelect && (
          <div style={helperTextStyles}>
            {disableEditing
              ? 'Finish processing to edit frames'
              : compact
              ? 'Tap a frame to edit (scroll for more)'
              : 'Tap any frame to correct rolls or totals'}
          </div>
        )}
        
        <div style={totalScoreStyles}>
          <div style={scoreTextStyles}>
            Total Score: {game.totalScore}
          </div>
          {game.totalScore === 300 && (
            <div style={perfectGameStyles}>
              🎳 PERFECT GAME! 🎳
            </div>
          )}
          {confidencePercent !== null && (
            <div style={{ ...confidenceStyles, color: confidenceColor }}>
              Confidence: {confidencePercent}%
            </div>
          )}
          {generalIssues.length > 0 && (
            <div style={issuesContainerStyles}>
              ⚠︎ {generalIssues.join(' • ')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
