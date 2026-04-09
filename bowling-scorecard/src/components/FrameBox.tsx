import React from 'react';
import { FrameDisplay } from '../types/bowling';
import type { ActiveRoll } from '../utils/frameCorrection';

interface FrameBoxProps {
  frameNumber: number;
  frameDisplay: FrameDisplay;
  isTenthFrame?: boolean;
  compact?: boolean;
  activeRoll?: ActiveRoll | null;
  heatIntensity?: number;
  frameTrend?: number[];
  showTrendPreview?: boolean;
  trendSelectedIndex?: number | null;
}

const frameBoxStyles: React.CSSProperties = {
  position: 'relative',
  border: '1px solid #93c5fd',
  borderRadius: '10px',
  backgroundColor: '#0b1738',
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  height: '90px',
  overflow: 'visible',
  boxShadow: '0 8px 18px rgba(2, 6, 23, 0.35), inset 0 0 0 1px rgba(148, 163, 184, 0.24)'
};

const frameHeaderStyles: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
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
  position: 'relative',
  zIndex: 1,
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

const activeRollStyles: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(125, 211, 252, 0.32) 0%, rgba(59, 130, 246, 0.34) 100%)',
  boxShadow: 'inset 0 0 0 2px rgba(224, 242, 254, 0.9), inset 0 -10px 18px rgba(37, 99, 235, 0.28)',
  color: '#ffffff'
};

const scoreBoxStyles: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
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

const trendPreviewStyles: React.CSSProperties = {
  position: 'absolute',
  left: '50%',
  bottom: 'calc(100% + 10px)',
  transform: 'translateX(-50%)',
  zIndex: 8,
  width: '148px',
  borderRadius: '10px',
  padding: '8px 8px 6px',
  background: 'linear-gradient(180deg, rgba(8, 16, 42, 0.96) 0%, rgba(15, 23, 42, 0.96) 100%)',
  border: '1px solid rgba(96, 165, 250, 0.45)',
  boxShadow: '0 12px 28px rgba(2, 6, 23, 0.6)',
  pointerEvents: 'none'
};

const trendPreviewArrowStyles: React.CSSProperties = {
  position: 'absolute',
  left: '50%',
  bottom: '-7px',
  width: '12px',
  height: '12px',
  background: '#0f172a',
  borderRight: '1px solid rgba(96, 165, 250, 0.45)',
  borderBottom: '1px solid rgba(96, 165, 250, 0.45)',
  transform: 'translateX(-50%) rotate(45deg)'
};

const trendHeaderStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '6px',
  marginBottom: '4px',
  fontSize: '9px',
  color: '#cbd5e1',
  textTransform: 'uppercase',
  letterSpacing: '0.06em'
};

const trendValueStyles: React.CSSProperties = {
  color: '#f8fafc',
  fontWeight: 800
};

export const FrameBox: React.FC<FrameBoxProps> = ({
  frameNumber,
  frameDisplay,
  isTenthFrame = false,
  compact = false,
  activeRoll = null,
  heatIntensity,
  frameTrend,
  showTrendPreview = false,
  trendSelectedIndex = null
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

  const visibleActiveRoll =
    !isTenthFrame && activeRoll === 'roll1' && frameDisplay.roll2 === 'X' ? 'roll2' : activeRoll;
  const clampedHeatIntensity =
    typeof heatIntensity === 'number' && Number.isFinite(heatIntensity)
      ? Math.min(1, Math.max(0, heatIntensity))
      : null;
  const heatOverlayStyles =
    clampedHeatIntensity === null
      ? null
      : {
          position: 'absolute' as const,
          inset: '0',
          borderRadius: containerStyles.borderRadius,
          background: `linear-gradient(180deg, rgba(248, 113, 113, ${
            0.18 + clampedHeatIntensity * 0.26
          }) 0%, rgba(185, 28, 28, ${0.14 + clampedHeatIntensity * 0.36}) 100%)`,
          pointerEvents: 'none' as const
        };

  const trendValues =
    frameTrend?.filter((value): value is number => Number.isFinite(value)) ?? [];
  const selectedTrendValue =
    trendSelectedIndex !== null && trendSelectedIndex >= 0
      ? trendValues[trendSelectedIndex] ?? null
      : null;
  const trendPreviewWidth = compact ? 102 : 126;
  const trendPreviewHeight = compact ? 56 : 64;
  const trendPadding = 6;
  const trendMin = trendValues.length ? Math.min(...trendValues) : 0;
  const trendMax = trendValues.length ? Math.max(...trendValues) : 0;
  const trendRange = Math.max(trendMax - trendMin, 4);
  const trendXStep =
    trendValues.length > 1
      ? (trendPreviewWidth - trendPadding * 2) / (trendValues.length - 1)
      : 0;
  const trendPoints = trendValues.map((value, index) => {
    const x = trendPadding + trendXStep * index;
    const normalized = (value - trendMin) / trendRange;
    const y =
      trendPadding + (1 - normalized) * (trendPreviewHeight - trendPadding * 2);
    return { value, x, y };
  });
  const trendPolyline = trendPoints.map((point) => `${point.x},${point.y}`).join(' ');
  const trendActivePoint =
    trendSelectedIndex !== null && trendSelectedIndex >= 0
      ? trendPoints[trendSelectedIndex] ?? null
      : null;
  const shouldRenderTrendPreview = showTrendPreview && trendValues.length > 0;

  return (
    <div
      style={containerStyles}
      data-testid={`frame-box-${frameNumber}`}
      data-heat-intensity={
        clampedHeatIntensity === null ? undefined : clampedHeatIntensity.toFixed(2)
      }
    >
      {heatOverlayStyles ? <div style={heatOverlayStyles} aria-hidden="true" /> : null}
      {shouldRenderTrendPreview ? (
        <div
          data-testid={`frame-trend-preview-${frameNumber}`}
          aria-label={`Frame ${frameNumber} trend preview`}
          style={{
            ...trendPreviewStyles,
            width: compact ? '132px' : trendPreviewStyles.width
          }}
        >
          <div style={trendPreviewArrowStyles} aria-hidden="true" />
          <div style={trendHeaderStyles}>
            <span>{`Frame ${frameNumber} trend`}</span>
            <span style={trendValueStyles}>
              {selectedTrendValue !== null ? `Now ${selectedTrendValue}` : `Best ${trendMax}`}
            </span>
          </div>
          <svg
            viewBox={`0 0 ${trendPreviewWidth} ${trendPreviewHeight}`}
            width="100%"
            height={trendPreviewHeight}
            aria-hidden="true"
          >
            <line
              x1={trendPadding}
              x2={trendPreviewWidth - trendPadding}
              y1={trendPreviewHeight - trendPadding}
              y2={trendPreviewHeight - trendPadding}
              stroke="rgba(148, 163, 184, 0.25)"
              strokeWidth="1"
            />
            {trendPoints.length > 1 ? (
              <polyline
                fill="none"
                stroke="#60a5fa"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={trendPolyline}
              />
            ) : null}
            {trendPoints.map((point, index) => {
              const isActive = trendSelectedIndex === index;
              return (
                <circle
                  key={`trend-point-${frameNumber}-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r={isActive ? 3.5 : 2.5}
                  fill={isActive ? '#f8fafc' : '#93c5fd'}
                  stroke={isActive ? '#2563eb' : 'none'}
                  strokeWidth={isActive ? 1.5 : 0}
                />
              );
            })}
            {trendActivePoint ? (
              <circle
                cx={trendActivePoint.x}
                cy={trendActivePoint.y}
                r={4}
                fill="none"
                stroke="rgba(248, 250, 252, 0.7)"
                strokeWidth="1.5"
              />
            ) : null}
          </svg>
        </div>
      ) : null}
      <div style={headerStyles} data-testid={`frame-header-${frameNumber}`}>
        {frameNumber}
      </div>

      <div style={rollsContainerStyles}>
        <div style={{ flex: 1, display: 'flex' }}>
          {isTenthFrame ? (
            <div style={{ display: 'flex', flex: 1 }}>
              <div
                style={{
                  ...tenthRollStyles,
                  ...(visibleActiveRoll === 'roll1' ? activeRollStyles : {})
                }}
                data-testid={`frame-roll-${frameNumber}-1`}
                data-active-roll={visibleActiveRoll === 'roll1' ? 'true' : undefined}
              >
                {frameDisplay.roll1}
              </div>
              <div
                style={{
                  ...tenthRollStyles,
                  ...(visibleActiveRoll === 'roll2' ? activeRollStyles : {})
                }}
                data-testid={`frame-roll-${frameNumber}-2`}
                data-active-roll={visibleActiveRoll === 'roll2' ? 'true' : undefined}
              >
                {frameDisplay.roll2}
              </div>
              <div
                style={{
                  ...tenthRollStyles,
                  borderRight: 'none',
                  ...(visibleActiveRoll === 'roll3' ? activeRollStyles : {})
                }}
                data-testid={`frame-roll-${frameNumber}-3`}
                data-active-roll={visibleActiveRoll === 'roll3' ? 'true' : undefined}
              >
                {frameDisplay.roll3}
              </div>
            </div>
          ) : (
            <>
              <div
                style={{
                  ...primaryRollStyles,
                  ...(visibleActiveRoll === 'roll1' ? activeRollStyles : {})
                }}
                data-testid={`frame-roll-${frameNumber}-1`}
                data-active-roll={visibleActiveRoll === 'roll1' ? 'true' : undefined}
              >
                {frameDisplay.roll1}
              </div>
              <div
                style={{
                  ...secondaryRollStyles,
                  ...(visibleActiveRoll === 'roll2' ? activeRollStyles : {})
                }}
                data-testid={`frame-roll-${frameNumber}-2`}
                data-active-roll={visibleActiveRoll === 'roll2' ? 'true' : undefined}
              >
                {frameDisplay.roll2}
              </div>
            </>
          )}
        </div>
      </div>

      <div style={totalStyles} data-testid={`frame-score-${frameNumber}`}>
        {frameDisplay.frameScore !== null ? frameDisplay.frameScore : ''}
      </div>
    </div>
  );
};
