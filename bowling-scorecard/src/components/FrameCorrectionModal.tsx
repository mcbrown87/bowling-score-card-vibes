import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Frame, Game, Roll } from '../types/bowling';
import { recalculateGame } from '../utils/recalculateGame';

interface FrameCorrectionModalProps {
  game: Game;
  frameIndex: number; // 0-8 regular frames, 9 = tenth frame
  onApply: (updatedGame: Game) => void;
  onClose: () => void;
  isSaving?: boolean;
}

type ActiveRoll = 'roll1' | 'roll2' | 'roll3';

const overlayStyles: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(2, 6, 23, 0.74)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '14px',
  zIndex: 9999,
  overflowY: 'auto'
};

const modalStyles: React.CSSProperties = {
  width: 'min(620px, calc(100vw - 24px))',
  maxWidth: '620px',
  maxHeight: 'min(92vh, 760px)',
  background: 'linear-gradient(180deg, #0b1738 0%, #08102a 100%)',
  borderRadius: '18px',
  border: '1px solid #334155',
  boxShadow: '0 26px 60px rgba(2, 6, 23, 0.7)',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
  overflowY: 'auto'
};

const titleStyles: React.CSSProperties = {
  margin: 0,
  color: '#f8fafc',
  fontSize: '21px',
  fontWeight: 800,
  letterSpacing: '0.02em'
};

const subtitleStyles: React.CSSProperties = {
  margin: '4px 0 0',
  color: '#cbd5e1',
  fontSize: '13px',
  lineHeight: 1.45
};

const frameBoardStyles: React.CSSProperties = {
  borderRadius: '14px',
  border: '1px solid #60a5fa',
  backgroundColor: '#020617',
  padding: '12px',
  boxShadow: 'inset 0 0 0 1px rgba(148, 163, 184, 0.2)'
};

const frameLabelStyles: React.CSSProperties = {
  color: '#bae6fd',
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '8px'
};

const scorecardFrameStyles: React.CSSProperties = {
  border: '2px solid #e2e8f0',
  borderRadius: '10px',
  overflow: 'hidden',
  backgroundColor: '#0f172a'
};

const rollLaneStyles: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '0',
  borderBottom: '2px solid #e2e8f0'
};

const rollCellBaseStyles: React.CSSProperties = {
  minHeight: '66px',
  borderRight: '2px solid #e2e8f0',
  backgroundColor: '#0b1738',
  color: '#e2e8f0',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  cursor: 'pointer',
  transition: 'all 120ms ease',
  padding: '6px'
};

const rollCellActiveStyles: React.CSSProperties = {
  backgroundColor: '#1d4ed8',
  boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.75), 0 0 18px rgba(96, 165, 250, 0.6)',
  color: '#fff'
};

const rollCellDisabledStyles: React.CSSProperties = {
  opacity: 0.44,
  cursor: 'not-allowed',
  backgroundColor: '#1e293b'
};

const rollNameStyles: React.CSSProperties = {
  fontSize: '11px',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: '#93c5fd',
  fontWeight: 700
};

const rollValueStyles: React.CSSProperties = {
  fontSize: '30px',
  lineHeight: 1,
  fontWeight: 800,
  marginTop: '4px',
  fontFamily: "'Courier New', monospace"
};

const totalBarStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  background: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)'
};

const totalLabelStyles: React.CSSProperties = {
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: '#7dd3fc',
  fontWeight: 700
};

const totalValueStyles: React.CSSProperties = {
  color: '#f8fafc',
  fontSize: '22px',
  fontWeight: 800,
  fontFamily: "'Courier New', monospace"
};

const keypadGridStyles: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
  gap: '8px'
};

const pinButtonBaseStyles: React.CSSProperties = {
  borderRadius: '10px',
  border: '1px solid #64748b',
  minHeight: '44px',
  backgroundColor: '#0f172a',
  color: '#e2e8f0',
  fontWeight: 700,
  fontSize: '16px',
  cursor: 'pointer',
  fontFamily: "'Courier New', monospace"
};

const pinButtonActiveStyles: React.CSSProperties = {
  backgroundColor: '#1d4ed8',
  border: '1px solid #93c5fd',
  color: '#fff',
  boxShadow: '0 6px 16px rgba(29, 78, 216, 0.5)'
};

const pinButtonDisabledStyles: React.CSSProperties = {
  opacity: 0.4,
  cursor: 'not-allowed'
};

const utilityRowStyles: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '8px'
};

const utilityButtonStyles: React.CSSProperties = {
  borderRadius: '10px',
  border: '1px solid #60a5fa',
  minHeight: '40px',
  backgroundColor: '#082f49',
  color: '#e0f2fe',
  fontWeight: 700,
  cursor: 'pointer'
};

const helperStyles: React.CSSProperties = {
  margin: 0,
  color: '#94a3b8',
  fontSize: '12px',
  lineHeight: 1.45
};

const actionsRowStyles: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '10px',
  flexWrap: 'wrap'
};

const actionButtonStyles: React.CSSProperties = {
  border: 'none',
  borderRadius: '10px',
  padding: '10px 18px',
  fontSize: '15px',
  fontWeight: 700,
  cursor: 'pointer'
};

const secondaryButtonStyles: React.CSSProperties = {
  ...actionButtonStyles,
  backgroundColor: '#334155',
  color: '#f8fafc'
};

const primaryButtonStyles: React.CSSProperties = {
  ...actionButtonStyles,
  backgroundColor: '#1d4ed8',
  color: '#fff'
};

const pinsOptions = Array.from({ length: 11 }, (_, value) => value);

const clampPins = (value: unknown): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return 0;
  }
  return Math.min(10, Math.max(0, Math.round(num)));
};

const normalizeRegularFrame = (frame: Frame, rolls: Roll[]): Frame => {
  const normalizedRolls = rolls.slice(0, 2).map((roll) => ({ pins: clampPins(roll.pins) }));
  while (normalizedRolls.length < 2) {
    normalizedRolls.push({ pins: 0 });
  }

  const first = normalizedRolls[0]?.pins ?? 0;
  if (first === 10) {
    return {
      ...frame,
      rolls: [{ pins: 10 }],
      isStrike: true,
      isSpare: false
    };
  }

  const secondRaw = normalizedRolls[1]?.pins ?? 0;
  const second = Math.min(10 - first, clampPins(secondRaw));
  const isSpare = first + second === 10;

  return {
    ...frame,
    rolls: [{ pins: first }, { pins: second }],
    isStrike: false,
    isSpare
  };
};

const normalizeTenthFrame = (frame: Game['tenthFrame']): Game['tenthFrame'] => {
  const rolls = frame.rolls.slice(0, 3).map((roll) => ({ pins: clampPins(roll.pins) }));
  while (rolls.length < 2) {
    rolls.push({ pins: 0 });
  }

  const first = rolls[0]?.pins ?? 0;
  const second = rolls[1]?.pins ?? 0;
  const isStrike = first === 10;
  const isSpare = !isStrike && first + second === 10;

  return {
    ...frame,
    rolls,
    isStrike,
    isSpare
  };
};

const toDisplaySymbol = (
  roll: number,
  index: number,
  frameValues: { roll1: number; roll2: number },
  isTenthFrame: boolean
): string => {
  if (roll === 0) {
    return '-';
  }

  if (roll === 10 && (index === 0 || isTenthFrame)) {
    return 'X';
  }

  if (index === 1 && frameValues.roll1 < 10 && frameValues.roll1 + frameValues.roll2 === 10) {
    return '/';
  }

  return String(roll);
};

const modalBodyStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '12px'
};

export const FrameCorrectionModal: React.FC<FrameCorrectionModalProps> = ({
  game,
  frameIndex,
  onApply,
  onClose,
  isSaving = false
}) => {
  const isTenthFrame = frameIndex === 9;
  const baseFrame = isTenthFrame ? game.tenthFrame : game.frames[frameIndex];

  const [roll1, setRoll1] = useState(baseFrame?.rolls[0]?.pins ?? 0);
  const [roll2, setRoll2] = useState(baseFrame?.rolls[1]?.pins ?? 0);
  const [roll3, setRoll3] = useState(isTenthFrame ? baseFrame?.rolls[2]?.pins ?? 0 : 0);
  const [activeRoll, setActiveRoll] = useState<ActiveRoll>('roll1');

  const frameLabel = useMemo(() => (isTenthFrame ? 'Frame 10' : `Frame ${frameIndex + 1}`), [
    frameIndex,
    isTenthFrame
  ]);

  const secondRollMax = useMemo(() => {
    if (!isTenthFrame) {
      return roll1 === 10 ? 0 : Math.max(0, 10 - roll1);
    }

    if (roll1 === 10) {
      return 10;
    }

    return Math.max(0, 10 - roll1);
  }, [isTenthFrame, roll1]);

  const isSecondRollDisabled = !isTenthFrame && roll1 === 10;
  const canEditRoll3 = isTenthFrame && (roll1 === 10 || roll1 + roll2 === 10);

  const rollEnabled = useMemo(
    () => ({
      roll1: true,
      roll2: !isSecondRollDisabled,
      roll3: isTenthFrame ? canEditRoll3 : false
    }),
    [canEditRoll3, isSecondRollDisabled, isTenthFrame]
  );

  const moveToNextEditableRoll = useCallback(
    (current: ActiveRoll): ActiveRoll => {
      if (current === 'roll1' && rollEnabled.roll2) {
        return 'roll2';
      }
      if ((current === 'roll1' || current === 'roll2') && rollEnabled.roll3) {
        return 'roll3';
      }
      return current;
    },
    [rollEnabled.roll2, rollEnabled.roll3]
  );

  useEffect(() => {
    if (!isTenthFrame) {
      if (roll1 === 10 && roll2 !== 0) {
        setRoll2(0);
        return;
      }
      const max = Math.max(0, 10 - roll1);
      if (roll2 > max) {
        setRoll2(max);
      }
      return;
    }

    if (roll1 !== 10) {
      const max = Math.max(0, 10 - roll1);
      if (roll2 > max) {
        setRoll2(max);
      }
    }
  }, [isTenthFrame, roll1, roll2]);

  useEffect(() => {
    if (!isTenthFrame && roll3 !== 0) {
      setRoll3(0);
      return;
    }
    if (isTenthFrame && !canEditRoll3 && roll3 !== 0) {
      setRoll3(0);
    }
  }, [canEditRoll3, isTenthFrame, roll3]);

  useEffect(() => {
    if (!rollEnabled[activeRoll]) {
      if (rollEnabled.roll1) {
        setActiveRoll('roll1');
      } else if (rollEnabled.roll2) {
        setActiveRoll('roll2');
      } else if (rollEnabled.roll3) {
        setActiveRoll('roll3');
      }
    }
  }, [activeRoll, rollEnabled]);

  const applyStrike = () => {
    setRoll1(10);
    if (!isTenthFrame) {
      setRoll2(0);
      setActiveRoll('roll1');
      return;
    }
    if (!canEditRoll3) {
      setActiveRoll('roll2');
    }
  };

  const applySpare = () => {
    if (roll1 >= 10) {
      return;
    }
    setRoll2(10 - roll1);
    if (isTenthFrame) {
      setActiveRoll(canEditRoll3 ? 'roll3' : 'roll2');
    }
  };

  const setPinsForActiveRoll = (pins: number) => {
    const clamped = clampPins(pins);

    if (activeRoll === 'roll1') {
      setRoll1(clamped);
      if (!isTenthFrame && clamped === 10) {
        setRoll2(0);
      }
      setActiveRoll(moveToNextEditableRoll('roll1'));
      return;
    }

    if (activeRoll === 'roll2') {
      const safeValue = Math.min(secondRollMax, clamped);
      setRoll2(safeValue);
      setActiveRoll(moveToNextEditableRoll('roll2'));
      return;
    }

    if (activeRoll === 'roll3' && canEditRoll3) {
      setRoll3(clamped);
    }
  };

  const clearActiveRoll = () => {
    if (activeRoll === 'roll1') {
      setRoll1(0);
      return;
    }
    if (activeRoll === 'roll2') {
      setRoll2(0);
      return;
    }
    setRoll3(0);
  };

  const handleApply = () => {
    if (isSaving) {
      return;
    }
    const nextGame: Game = JSON.parse(JSON.stringify(game));

    if (isTenthFrame) {
      nextGame.tenthFrame = normalizeTenthFrame({
        ...nextGame.tenthFrame,
        rolls: [
          { pins: clampPins(roll1) },
          { pins: clampPins(roll2) },
          { pins: clampPins(canEditRoll3 ? roll3 : 0) }
        ]
      });
    } else {
      const nextFrame = normalizeRegularFrame(nextGame.frames[frameIndex], [
        { pins: clampPins(roll1) },
        { pins: clampPins(roll2) }
      ]);
      nextGame.frames[frameIndex] = nextFrame;
    }

    const recalculated = recalculateGame(nextGame);
    onApply(recalculated);
  };

  const previewFrameScore = useMemo(() => {
    const previewGame: Game = JSON.parse(JSON.stringify(game));

    if (isTenthFrame) {
      previewGame.tenthFrame = normalizeTenthFrame({
        ...previewGame.tenthFrame,
        rolls: [
          { pins: clampPins(roll1) },
          { pins: clampPins(roll2) },
          { pins: clampPins(canEditRoll3 ? roll3 : 0) }
        ]
      });
      return recalculateGame(previewGame).tenthFrame.score ?? 0;
    }

    previewGame.frames[frameIndex] = normalizeRegularFrame(previewGame.frames[frameIndex], [
      { pins: clampPins(roll1) },
      { pins: clampPins(roll2) }
    ]);
    return recalculateGame(previewGame).frames[frameIndex]?.score ?? 0;
  }, [canEditRoll3, frameIndex, game, isTenthFrame, roll1, roll2, roll3]);

  const displayedRolls = useMemo(
    () => [
      {
        key: 'roll1' as const,
        label: 'Roll 1',
        value: toDisplaySymbol(roll1, 0, { roll1, roll2 }, isTenthFrame),
        disabled: !rollEnabled.roll1,
        ariaLabel: `Select roll 1 (${roll1})`
      },
      {
        key: 'roll2' as const,
        label: 'Roll 2',
        value: toDisplaySymbol(roll2, 1, { roll1, roll2 }, isTenthFrame),
        disabled: !rollEnabled.roll2,
        ariaLabel: `Select roll 2 (${roll2})`
      },
      {
        key: 'roll3' as const,
        label: 'Roll 3',
        value: isTenthFrame ? toDisplaySymbol(roll3, 2, { roll1, roll2 }, true) : '',
        disabled: !rollEnabled.roll3,
        ariaLabel: isTenthFrame
          ? `Select roll 3 (${roll3})`
          : 'Roll 3 unavailable for frames 1 through 9'
      }
    ],
    [isTenthFrame, roll1, roll2, roll3, rollEnabled.roll1, rollEnabled.roll2, rollEnabled.roll3]
  );

  return (
    <div style={overlayStyles}>
      <div style={modalStyles} role="dialog" aria-modal="true" aria-label={`Correct ${frameLabel}`}>
        <div>
          <h2 style={titleStyles}>{frameLabel} Score Correction</h2>
          <p style={subtitleStyles}>
            Tap a roll cell, then use the keypad to enter pins like a lane score monitor.
          </p>
        </div>

        <div style={modalBodyStyle}>
          <div style={frameBoardStyles}>
            <div style={frameLabelStyles}>{frameLabel} Preview</div>
            <div style={scorecardFrameStyles}>
              <div style={rollLaneStyles}>
                {displayedRolls.map((roll, index) => {
                  const isActive = activeRoll === roll.key;
                  const isLast = index === displayedRolls.length - 1;

                  return (
                    <button
                      key={roll.key}
                      type="button"
                      aria-label={roll.ariaLabel}
                      aria-pressed={isActive}
                      disabled={roll.disabled}
                      onClick={() => {
                        if (!roll.disabled) {
                          setActiveRoll(roll.key);
                        }
                      }}
                      style={{
                        ...rollCellBaseStyles,
                        ...(isActive ? rollCellActiveStyles : {}),
                        ...(roll.disabled ? rollCellDisabledStyles : {}),
                        ...(isLast ? { borderRight: 'none' } : {})
                      }}
                    >
                      <span style={rollNameStyles}>{roll.label}</span>
                      <span style={rollValueStyles}>{roll.value}</span>
                    </button>
                  );
                })}
              </div>
              <div style={totalBarStyles}>
                <span style={totalLabelStyles}>Running Total</span>
                <span style={totalValueStyles}>{previewFrameScore}</span>
              </div>
            </div>
          </div>

          <div style={keypadGridStyles}>
            {pinsOptions.map((pins) => {
              const optionDisabled =
                isSaving ||
                !rollEnabled[activeRoll] ||
                (activeRoll === 'roll2' && pins > secondRollMax);

              const isActiveValue =
                (activeRoll === 'roll1' && roll1 === pins) ||
                (activeRoll === 'roll2' && roll2 === pins) ||
                (activeRoll === 'roll3' && roll3 === pins);

              return (
                <button
                  key={`pins-${pins}`}
                  type="button"
                  disabled={optionDisabled}
                  aria-pressed={isActiveValue}
                  aria-label={`Set ${activeRoll} to ${pins} pins`}
                  onClick={() => setPinsForActiveRoll(pins)}
                  style={{
                    ...pinButtonBaseStyles,
                    ...(isActiveValue ? pinButtonActiveStyles : {}),
                    ...(optionDisabled ? pinButtonDisabledStyles : {})
                  }}
                >
                  {pins}
                </button>
              );
            })}
          </div>

          <div style={utilityRowStyles}>
            <button type="button" style={utilityButtonStyles} onClick={applyStrike} disabled={isSaving}>
              Strike (X)
            </button>
            <button
              type="button"
              style={{ ...utilityButtonStyles, ...(roll1 >= 10 ? pinButtonDisabledStyles : {}) }}
              onClick={applySpare}
              disabled={isSaving || roll1 >= 10}
            >
              Spare (/)
            </button>
            <button
              type="button"
              style={utilityButtonStyles}
              onClick={clearActiveRoll}
              disabled={isSaving || !rollEnabled[activeRoll]}
            >
              Clear Active
            </button>
          </div>

          <p style={helperStyles}>
            Active input: {activeRoll === 'roll1' ? 'Roll 1' : activeRoll === 'roll2' ? 'Roll 2' : 'Roll 3'}.
            {!isTenthFrame && isSecondRollDisabled ? ' Roll 2 is locked after a strike in frames 1-9.' : ''}
            {isTenthFrame && !canEditRoll3 ? ' Roll 3 unlocks after a strike or spare in frame 10.' : ''}
          </p>
        </div>

        <div style={actionsRowStyles}>
          <button type="button" style={secondaryButtonStyles} onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button type="button" style={primaryButtonStyles} onClick={handleApply} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
