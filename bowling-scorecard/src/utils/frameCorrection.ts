import type { Game, Frame, Roll } from '../types/bowling';
import { recalculateGame } from './recalculateGame';

export type ActiveRoll = 'roll1' | 'roll2' | 'roll3';

export interface FrameCorrectionState {
  isTenthFrame: boolean;
  roll1: number;
  roll2: number;
  roll3: number;
  secondRollMax: number;
  isSecondRollDisabled: boolean;
  canEditRoll3: boolean;
  rollEnabled: Record<ActiveRoll, boolean>;
}

export interface DesktopKeyResult {
  game: Game;
  frameIndex: number;
  activeRoll: ActiveRoll;
  changed: boolean;
}

export const clampPins = (value: unknown): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return 0;
  }
  return Math.min(10, Math.max(0, Math.round(num)));
};

const cloneGame = (game: Game): Game => JSON.parse(JSON.stringify(game)) as Game;

export const normalizeRegularFrame = (frame: Frame, rolls: Roll[]): Frame => {
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

export const normalizeTenthFrame = (frame: Game['tenthFrame']): Game['tenthFrame'] => {
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

export const getFrameCorrectionState = (game: Game, frameIndex: number): FrameCorrectionState => {
  const isTenthFrame = frameIndex === 9;
  const frame = isTenthFrame ? game.tenthFrame : game.frames[frameIndex];
  const roll1 = frame?.rolls[0]?.pins ?? 0;
  const roll2 = frame?.rolls[1]?.pins ?? 0;
  const roll3 = isTenthFrame ? frame?.rolls[2]?.pins ?? 0 : 0;
  const secondRollMax = !isTenthFrame
    ? roll1 === 10
      ? 0
      : Math.max(0, 10 - roll1)
    : roll1 === 10
      ? 10
      : Math.max(0, 10 - roll1);
  const isSecondRollDisabled = !isTenthFrame && roll1 === 10;
  const canEditRoll3 = isTenthFrame && (roll1 === 10 || roll1 + roll2 === 10);

  return {
    isTenthFrame,
    roll1,
    roll2,
    roll3,
    secondRollMax,
    isSecondRollDisabled,
    canEditRoll3,
    rollEnabled: {
      roll1: true,
      roll2: !isSecondRollDisabled,
      roll3: isTenthFrame ? canEditRoll3 : false
    }
  };
};

export const getFirstEditableRoll = (game: Game, frameIndex: number): ActiveRoll => {
  const state = getFrameCorrectionState(game, frameIndex);
  if (state.rollEnabled.roll1) {
    return 'roll1';
  }
  if (state.rollEnabled.roll2) {
    return 'roll2';
  }
  return 'roll3';
};

const normalizeActiveRoll = (game: Game, frameIndex: number, activeRoll: ActiveRoll): ActiveRoll => {
  const state = getFrameCorrectionState(game, frameIndex);
  if (state.rollEnabled[activeRoll]) {
    return activeRoll;
  }
  return getFirstEditableRoll(game, frameIndex);
};

const getEditableRolls = (game: Game, frameIndex: number): ActiveRoll[] => {
  const state = getFrameCorrectionState(game, frameIndex);
  return (['roll1', 'roll2', 'roll3'] as ActiveRoll[]).filter((roll) => state.rollEnabled[roll]);
};

const getLastEditableRoll = (game: Game, frameIndex: number): ActiveRoll => {
  const editableRolls = getEditableRolls(game, frameIndex);
  return editableRolls[editableRolls.length - 1] ?? 'roll1';
};

const getAdjacentEditablePosition = (
  game: Game,
  frameIndex: number,
  activeRoll: ActiveRoll,
  direction: -1 | 1
): { frameIndex: number; activeRoll: ActiveRoll } => {
  const normalizedRoll = normalizeActiveRoll(game, frameIndex, activeRoll);
  const editableRolls = getEditableRolls(game, frameIndex);
  const rollIndex = Math.max(0, editableRolls.indexOf(normalizedRoll));
  const nextRoll = editableRolls[rollIndex + direction];

  if (nextRoll) {
    return { frameIndex, activeRoll: nextRoll };
  }

  const nextFrameIndex = frameIndex + direction;
  if (nextFrameIndex < 0 || nextFrameIndex > 9) {
    return { frameIndex, activeRoll: normalizedRoll };
  }

  return {
    frameIndex: nextFrameIndex,
    activeRoll:
      direction === 1
        ? getFirstEditableRoll(game, nextFrameIndex)
        : getLastEditableRoll(game, nextFrameIndex)
  };
};

const updateFrame = (game: Game, frameIndex: number, updater: (next: Game) => void): Game => {
  const nextGame = cloneGame(game);
  updater(nextGame);
  return recalculateGame(nextGame);
};

export const setPinsForRoll = (
  game: Game,
  frameIndex: number,
  activeRoll: ActiveRoll,
  pins: number
): Game => {
  const state = getFrameCorrectionState(game, frameIndex);
  const clamped = clampPins(pins);

  return updateFrame(game, frameIndex, (nextGame) => {
    if (state.isTenthFrame) {
      const nextFrame = normalizeTenthFrame({
        ...nextGame.tenthFrame,
        rolls: [
          { pins: activeRoll === 'roll1' ? clamped : state.roll1 },
          {
            pins:
              activeRoll === 'roll2' ? Math.min(state.secondRollMax, clamped) : state.roll2
          },
          {
            pins:
              activeRoll === 'roll3' && state.canEditRoll3
                ? clamped
                : state.roll3
          }
        ]
      });
      nextGame.tenthFrame = nextFrame;
      return;
    }

    const nextFrame = normalizeRegularFrame(nextGame.frames[frameIndex], [
      { pins: activeRoll === 'roll1' ? clamped : state.roll1 },
      {
        pins:
          activeRoll === 'roll2' ? Math.min(state.secondRollMax, clamped) : state.roll2
      }
    ]);
    nextGame.frames[frameIndex] = nextFrame;
  });
};

export const clearRollValue = (game: Game, frameIndex: number, activeRoll: ActiveRoll): Game =>
  updateFrame(game, frameIndex, (nextGame) => {
    if (frameIndex === 9 && activeRoll === 'roll3') {
      nextGame.tenthFrame = normalizeTenthFrame({
        ...nextGame.tenthFrame,
        rolls: nextGame.tenthFrame.rolls.slice(0, 2)
      });
      return;
    }

    const updatedGame = setPinsForRoll(nextGame, frameIndex, activeRoll, 0);
    Object.assign(nextGame, updatedGame);
  });

export const applyStrikeToRoll = (
  game: Game,
  frameIndex: number,
  activeRoll: ActiveRoll
): Game => setPinsForRoll(game, frameIndex, activeRoll, 10);

export const applyDesktopScoreKey = (
  game: Game,
  frameIndex: number,
  activeRoll: ActiveRoll,
  key: string
): DesktopKeyResult => {
  let nextFrameIndex = frameIndex;
  let nextActiveRoll = normalizeActiveRoll(game, frameIndex, activeRoll);

  if (key === 'ArrowLeft') {
    const previousPosition = getAdjacentEditablePosition(game, frameIndex, nextActiveRoll, -1);
    return {
      game,
      frameIndex: previousPosition.frameIndex,
      activeRoll: previousPosition.activeRoll,
      changed: false
    };
  }

  if (key === 'ArrowRight') {
    const nextPosition = getAdjacentEditablePosition(game, frameIndex, nextActiveRoll, 1);
    return {
      game,
      frameIndex: nextPosition.frameIndex,
      activeRoll: nextPosition.activeRoll,
      changed: false
    };
  }

  let updatedGame = game;
  if (/^[0-9]$/.test(key)) {
    updatedGame = setPinsForRoll(game, frameIndex, nextActiveRoll, Number(key));
  } else if (key === 'x' || key === 'X') {
    updatedGame = applyStrikeToRoll(game, frameIndex, nextActiveRoll);
  } else if (key === 'Backspace' || key === 'Delete') {
    updatedGame = clearRollValue(game, frameIndex, nextActiveRoll);
  } else {
    return { game, frameIndex, activeRoll: nextActiveRoll, changed: false };
  }

  const nextState = getFrameCorrectionState(updatedGame, frameIndex);
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    return { game: updatedGame, frameIndex: nextFrameIndex, activeRoll: nextActiveRoll, changed: true };
  }

  if (key === 'Backspace' || key === 'Delete') {
    return {
      game: updatedGame,
      frameIndex,
      activeRoll: normalizeActiveRoll(updatedGame, frameIndex, nextActiveRoll),
      changed: true
    };
  }

  if (!nextState.isTenthFrame) {
    const lastEditableRoll = getLastEditableRoll(updatedGame, frameIndex);
    if (nextActiveRoll === 'roll1' && nextState.roll1 === 10) {
      nextFrameIndex = Math.min(9, frameIndex + 1);
      return {
        game: updatedGame,
        frameIndex: nextFrameIndex,
        activeRoll: getFirstEditableRoll(updatedGame, nextFrameIndex),
        changed: true
      };
    }

    if (nextActiveRoll !== lastEditableRoll) {
      return {
        game: updatedGame,
        frameIndex,
        activeRoll: getAdjacentEditablePosition(updatedGame, frameIndex, nextActiveRoll, 1).activeRoll,
        changed: true
      };
    }

    nextFrameIndex = Math.min(9, frameIndex + 1);
    return {
      game: updatedGame,
      frameIndex: nextFrameIndex,
      activeRoll: getFirstEditableRoll(updatedGame, nextFrameIndex),
      changed: true
    };
  }

  if (nextActiveRoll === 'roll1') {
    return {
      game: updatedGame,
      frameIndex,
      activeRoll: nextState.rollEnabled.roll2 ? 'roll2' : 'roll1',
      changed: true
    };
  }

  if (nextActiveRoll === 'roll2') {
    return {
      game: updatedGame,
      frameIndex,
      activeRoll: nextState.rollEnabled.roll3 ? 'roll3' : 'roll1',
      changed: true
    };
  }

  return { game: updatedGame, frameIndex, activeRoll: 'roll1', changed: true };
};
