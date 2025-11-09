import { Frame, Game, TenthFrame } from '../types/bowling';

const clampPins = (value: unknown): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return 0;
  }
  return Math.min(10, Math.max(0, Math.round(num)));
};

const normalizeRegularFrame = (frame: Frame): Frame => {
  const rolls = frame.rolls.slice(0, 2).map((roll) => ({ pins: clampPins(roll.pins) }));
  while (rolls.length < 2) {
    rolls.push({ pins: 0 });
  }

  const first = rolls[0]?.pins ?? 0;
  if (first === 10) {
    return {
      rolls: [{ pins: 10 }],
      isStrike: true,
      isSpare: false,
      score: frame.score
    };
  }

  const secondRaw = rolls[1]?.pins ?? 0;
  const second = Math.min(10 - first, clampPins(secondRaw));
  const isSpare = first + second === 10;

  return {
    rolls: [{ pins: first }, { pins: second }],
    isStrike: false,
    isSpare,
    score: frame.score
  };
};

const normalizeTenthFrame = (frame: TenthFrame): TenthFrame => {
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

const flattenRolls = (frames: Frame[], tenthFrame: TenthFrame): number[] => {
  const flattened: number[] = [];
  frames.forEach((frame) => {
    frame.rolls.forEach((roll) => flattened.push(clampPins(roll.pins)));
  });
  tenthFrame.rolls.forEach((roll) => flattened.push(clampPins(roll.pins)));
  return flattened;
};

const computeRunningTotals = (frames: Frame[], tenthFrame: TenthFrame): number[] => {
  const rolls = flattenRolls(frames, tenthFrame);
  const totals: number[] = [];
  let rollIndex = 0;
  let runningTotal = 0;

  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    const first = rolls[rollIndex] ?? 0;
    let frameScore = 0;

    if (first === 10) {
      const bonus1 = rolls[rollIndex + 1] ?? 0;
      const bonus2 = rolls[rollIndex + 2] ?? 0;
      frameScore = 10 + bonus1 + bonus2;
      rollIndex += 1;
    } else {
      const second = rolls[rollIndex + 1] ?? 0;
      const framePins = first + second;
      if (framePins === 10) {
        const bonus = rolls[rollIndex + 2] ?? 0;
        frameScore = 10 + bonus;
      } else {
        frameScore = framePins;
      }
      rollIndex += 2;
    }

    runningTotal += frameScore;
    totals.push(runningTotal);
  }

  const tenthPins = tenthFrame.rolls.reduce((sum, roll) => sum + clampPins(roll.pins), 0);
  totals.push(runningTotal + tenthPins);
  return totals;
};

export const recalculateGame = (game: Game): Game => {
  const cloned: Game = JSON.parse(JSON.stringify(game));
  cloned.frames = cloned.frames.map((frame) => normalizeRegularFrame(frame));
  cloned.tenthFrame = normalizeTenthFrame(cloned.tenthFrame);

  const totals = computeRunningTotals(cloned.frames, cloned.tenthFrame);

  cloned.frames = cloned.frames.map((frame, index) => ({
    ...frame,
    score: totals[index]
  }));

  cloned.tenthFrame.score = totals[totals.length - 1];
  cloned.totalScore = cloned.tenthFrame.score ?? cloned.totalScore;

  return cloned;
};
