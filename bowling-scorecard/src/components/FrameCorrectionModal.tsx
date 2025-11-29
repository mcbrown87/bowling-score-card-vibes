import React, { useEffect, useMemo, useState } from 'react';
import { Frame, Game, Roll } from '../types/bowling';
import { recalculateGame } from '../utils/recalculateGame';

interface FrameCorrectionModalProps {
  game: Game;
  frameIndex: number; // 0-8 regular frames, 9 = tenth frame
  onApply: (updatedGame: Game) => void;
  onClose: () => void;
  isSaving?: boolean;
}

const overlayStyles: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '16px',
  zIndex: 9999,
  overflowY: 'auto'
};

const modalStyles: React.CSSProperties = {
  width: 'min(520px, calc(100vw - 24px))',
  maxWidth: '520px',
  maxHeight: 'min(90vh, 720px)',
  backgroundColor: '#fff',
  borderRadius: '18px',
  boxShadow: '0 24px 50px rgba(15, 23, 42, 0.25)',
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  overflowY: 'auto'
};

const titleStyles: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#0f172a'
};

const labelStyles: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#0f172a'
};

const helperStyles: React.CSSProperties = {
  fontSize: '12px',
  color: '#64748b',
  lineHeight: 1.4
};

const actionsRowStyles: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '12px',
  flexWrap: 'wrap'
};

const actionButtonStyles: React.CSSProperties = {
  border: 'none',
  borderRadius: '8px',
  padding: '10px 18px',
  fontSize: '16px',
  fontWeight: 600,
  cursor: 'pointer'
};

const secondaryButtonStyles: React.CSSProperties = {
  ...actionButtonStyles,
  backgroundColor: '#e2e8f0',
  color: '#0f172a'
};

const primaryButtonStyles: React.CSSProperties = {
  ...actionButtonStyles,
  backgroundColor: '#2563eb',
  color: 'white'
};

const rollSectionStyles: React.CSSProperties = {
  display: 'grid',
  gap: '12px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))'
};

const pinsGridStyles: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
  gap: '6px'
};

const rollButtonBaseStyles: React.CSSProperties = {
  borderRadius: '12px',
  padding: '8px 0',
  border: '1px solid #cbd5f5',
  backgroundColor: '#fff',
  fontWeight: 600,
  fontSize: '15px',
  cursor: 'pointer'
};

const rollButtonActiveStyles: React.CSSProperties = {
  backgroundColor: '#2563eb',
  borderColor: '#1d4ed8',
  color: '#fff',
  boxShadow: '0 6px 15px rgba(37, 99, 235, 0.35)'
};

const rollButtonDisabledStyles: React.CSSProperties = {
  opacity: 0.45,
  cursor: 'not-allowed'
};

const quickActionsRowStyles: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px'
};

const quickActionButtonStyles: React.CSSProperties = {
  borderRadius: '999px',
  border: '1px solid #e2e8f0',
  padding: '6px 14px',
  backgroundColor: '#f1f5f9',
  fontSize: '14px',
  fontWeight: 600,
  color: '#0f172a',
  cursor: 'pointer'
};

const pinsOptions = Array.from({ length: 11 }, (_, value) => value);

interface RollSelectorProps {
  label: string;
  value: number;
  onSelect: (pins: number) => void;
  maxPins?: number;
  disabled?: boolean;
  helper?: string;
}

const RollSelector: React.FC<RollSelectorProps> = ({ label, value, onSelect, maxPins = 10, disabled, helper }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
      <div style={labelStyles}>{label}</div>
      <div style={pinsGridStyles}>
        {pinsOptions.map((pins) => {
          const optionDisabled = Boolean(disabled) || pins > maxPins;
          const baseStyle = { ...rollButtonBaseStyles, ...(pins === value ? rollButtonActiveStyles : {}) };
          return (
            <button
              key={`${label}-${pins}`}
              type="button"
              disabled={optionDisabled}
              aria-pressed={pins === value}
              style={{ ...baseStyle, ...(optionDisabled ? rollButtonDisabledStyles : {}) }}
              onClick={() => {
                if (!optionDisabled) {
                  onSelect(pins);
                }
              }}
            >
              {pins}
            </button>
          );
        })}
      </div>
      {helper ? <p style={helperStyles}>{helper}</p> : null}
    </div>
  );
};

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
    }
    if (isTenthFrame && !canEditRoll3 && roll3 !== 0) {
      setRoll3(0);
    }
  }, [canEditRoll3, isTenthFrame, roll3]);

  const applyStrike = () => {
    setRoll1(10);
    if (!isTenthFrame) {
      setRoll2(0);
    }
  };

  const applySpare = () => {
    if (roll1 >= 10) {
      return;
    }
    setRoll2(10 - roll1);
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

  return (
    <div style={overlayStyles}>
      <div style={modalStyles} role="dialog" aria-modal="true" aria-label={`Correct ${frameLabel}`}>
        <div>
          <div style={titleStyles}>{frameLabel} — Correct score</div>
          <p style={{ fontSize: '14px', color: '#475569', marginTop: '4px' }}>
            Tap a value for each roll. The totals update automatically once you save.
          </p>
        </div>

        <div>
          <div style={quickActionsRowStyles}>
            <button type="button" style={quickActionButtonStyles} onClick={applyStrike}>
              Mark strike
            </button>
            <button
              type="button"
              style={{
                ...quickActionButtonStyles,
                ...(roll1 >= 10 ? rollButtonDisabledStyles : {})
              }}
              disabled={roll1 >= 10}
              onClick={applySpare}
            >
              Fill spare
            </button>
          </div>
          <p style={{ ...helperStyles, marginTop: '6px' }}>
            Need to override the auto-read? Quickly mark a strike or spare, or tap specific pin counts
            below.
          </p>
        </div>

        <div style={rollSectionStyles}>
          <RollSelector label="Roll 1" value={roll1} onSelect={setRoll1} helper="First roll pins knocked down." />
          <RollSelector
            label="Roll 2"
            value={roll2}
            onSelect={setRoll2}
            maxPins={secondRollMax}
            disabled={isSecondRollDisabled}
            helper={
              isSecondRollDisabled
                ? 'Strike recorded — no second roll needed for this frame.'
                : `Pick up to ${secondRollMax} pins for the second roll.`
            }
          />
          {isTenthFrame && (
            <RollSelector
              label="Roll 3"
              value={roll3}
              onSelect={setRoll3}
              disabled={!canEditRoll3}
              helper={
                canEditRoll3
                  ? 'Bonus roll unlocked from a strike or spare in frame 10.'
                  : 'Earn a strike or spare to unlock the final roll.'
              }
            />
          )}
        </div>

        <div style={actionsRowStyles}>
          <button type="button" style={secondaryButtonStyles} onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button
            type="button"
            style={primaryButtonStyles}
            onClick={handleApply}
            disabled={isSaving}
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
