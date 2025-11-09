import React, { useMemo, useState } from 'react';
import { Frame, Game, Roll } from '../types/bowling';
import { recalculateGame } from '../utils/recalculateGame';

interface FrameCorrectionModalProps {
  game: Game;
  frameIndex: number; // 0-8 regular frames, 9 = tenth frame
  onApply: (updatedGame: Game) => void;
  onClose: () => void;
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
  maxWidth: '420px',
  backgroundColor: '#fff',
  borderRadius: '18px',
  boxShadow: '0 24px 50px rgba(15, 23, 42, 0.25)',
  padding: '24px 24px 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px'
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

const numberInputStyles: React.CSSProperties = {
  width: '88px',
  padding: '10px 10px',
  borderRadius: '8px',
  border: '1px solid #cbd5f5',
  fontSize: '16px'
};

const rollInputsRowStyles: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap'
};

const helperStyles: React.CSSProperties = {
  fontSize: '13px',
  color: '#64748b'
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
  onClose
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

  const handleApply = () => {
    const nextGame: Game = JSON.parse(JSON.stringify(game));

    if (isTenthFrame) {
      nextGame.tenthFrame = normalizeTenthFrame({
        ...nextGame.tenthFrame,
        rolls: [{ pins: clampPins(roll1) }, { pins: clampPins(roll2) }, { pins: clampPins(roll3) }]
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
            Update the rolls for this frame. Running totals will refresh automatically when you save.
          </p>
        </div>

        <div style={rollInputsRowStyles}>
          <label style={labelStyles}>
            Roll 1
            <input
              type="number"
              min={0}
              max={10}
              step={1}
              style={{ ...numberInputStyles, marginTop: '6px' }}
              value={roll1}
              onChange={(event) => setRoll1(Number(event.target.value))}
            />
          </label>
          <label style={labelStyles}>
            Roll 2
            <input
              type="number"
              min={0}
              max={10}
              step={1}
              style={{ ...numberInputStyles, marginTop: '6px' }}
              value={roll2}
              onChange={(event) => setRoll2(Number(event.target.value))}
            />
          </label>
          {isTenthFrame && (
            <label style={labelStyles}>
              Roll 3
              <input
                type="number"
                min={0}
                max={10}
                step={1}
                style={{ ...numberInputStyles, marginTop: '6px' }}
                value={roll3}
                onChange={(event) => setRoll3(Number(event.target.value))}
              />
            </label>
          )}
          <p style={{ ...helperStyles, marginTop: '4px' }}>
            Frame totals are derived from these rolls; no manual running total needed.
          </p>
        </div>

        <div style={actionsRowStyles}>
          <button type="button" style={secondaryButtonStyles} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={primaryButtonStyles} onClick={handleApply}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
