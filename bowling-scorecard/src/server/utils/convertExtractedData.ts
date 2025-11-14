import type { ExtractionPayload, Game, Frame, TenthFrame } from '@/types/bowling';

type RawFrame = {
  frameNumber?: number;
  rolls?: Array<{ pins?: number } | number>;
  isStrike?: boolean;
  isSpare?: boolean;
  runningTotal?: number;
};

const clampPins = (value: unknown): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return 0;
  }
  if (num < 0) {
    return 0;
  }
  if (num > 10) {
    return 10;
  }
  return Math.round(num);
};

const normalizeRolls = (rolls: Array<{ pins?: number } | number> | undefined): { pins: number }[] => {
  if (!Array.isArray(rolls)) {
    return [];
  }

  return rolls.map((roll) => {
    if (typeof roll === 'number') {
      return { pins: roll };
    }

    const pins = Number.isFinite(roll?.pins) ? Number(roll?.pins) : 0;
    return { pins };
  });
};

type PlayerPayload = NonNullable<ExtractionPayload['players']>[number];

const sanitizeRegularFrame = (frame: Frame): Frame => {
  const rawRolls = frame.rolls ?? [];
  const sanitizedRolls = rawRolls.map((roll) => ({ pins: clampPins(roll.pins) }));

  const firstRollPins = sanitizedRolls[0]?.pins ?? 0;
  if (firstRollPins === 10) {
    return {
      rolls: [{ pins: 10 }],
      isStrike: true,
      isSpare: false,
      score: frame.score ?? 0
    };
  }

  const secondRollPinsRaw = sanitizedRolls[1]?.pins ?? 0;
  const secondRollPins = Math.max(0, Math.min(10 - firstRollPins, clampPins(secondRollPinsRaw)));
  const firstRoll = { pins: firstRollPins };
  const secondRoll = { pins: sanitizedRolls.length >= 2 ? secondRollPins : 0 };
  const rolls: { pins: number }[] = [firstRoll, secondRoll];

  const framePinSum = firstRoll.pins + secondRoll.pins;
  const isSpare = framePinSum === 10;

  return {
    rolls,
    isStrike: false,
    isSpare,
    score: frame.score ?? 0
  };
};

const sanitizeTenthFrame = (frame: TenthFrame): TenthFrame => {
  const rolls = (frame.rolls ?? []).slice(0, 3).map((roll) => ({ pins: clampPins(roll.pins) }));

  while (rolls.length < 2) {
    rolls.push({ pins: 0 });
  }

  const first = rolls[0]?.pins ?? 0;
  const second = rolls[1]?.pins ?? 0;

  const isStrike = first === 10;
  const isSpare = !isStrike && first + second === 10;

  return {
    rolls,
    isStrike,
    isSpare,
    score: frame.score ?? 0
  };
};

const computeRunningTotals = (frames: Frame[], tenthFrame: TenthFrame): number[] => {
  const flattenedRolls: number[] = [];
  frames.forEach((frame) => {
    frame.rolls.forEach((roll) => {
      flattenedRolls.push(clampPins(roll.pins));
    });
  });
  tenthFrame.rolls.forEach((roll) => {
    flattenedRolls.push(clampPins(roll.pins));
  });

  const totals: number[] = [];
  let rollIndex = 0;
  let runningTotal = 0;

  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    const first = flattenedRolls[rollIndex] ?? 0;
    let frameScore = 0;

    if (first === 10) {
      const bonus1 = flattenedRolls[rollIndex + 1] ?? 0;
      const bonus2 = flattenedRolls[rollIndex + 2] ?? 0;
      frameScore = 10 + bonus1 + bonus2;
      rollIndex += 1;
    } else {
      const second = flattenedRolls[rollIndex + 1] ?? 0;
      const framePins = first + second;

      if (framePins === 10) {
        const bonus = flattenedRolls[rollIndex + 2] ?? 0;
        frameScore = 10 + bonus;
      } else {
        frameScore = framePins;
      }

      rollIndex += 2;
    }

    runningTotal += frameScore;
    totals.push(runningTotal);
  }

  const tenthFramePins = tenthFrame.rolls.reduce((sum, roll) => sum + clampPins(roll.pins), 0);
  totals.push(runningTotal + tenthFramePins);

  return totals;
};

const enforceConsistency = ({
  playerName,
  frames,
  tenthFrame,
  transcribedTotals,
  transcribedTenthTotal
}: {
  playerName: string;
  frames: Frame[];
  tenthFrame: TenthFrame;
  transcribedTotals: Array<number | undefined>;
  transcribedTenthTotal?: number;
}): { computedTotals: number[]; issues: string[] } => {
  for (let i = 0; i < frames.length; i += 1) {
    const frame = frames[i];
    if (!frame) {
      continue;
    }
    frames[i] = sanitizeRegularFrame(frame);
  }

  const normalizedTenth = sanitizeTenthFrame(tenthFrame);
  tenthFrame.rolls = normalizedTenth.rolls;
  tenthFrame.isStrike = normalizedTenth.isStrike;
  tenthFrame.isSpare = normalizedTenth.isSpare;

  const computedTotals = computeRunningTotals(frames, tenthFrame);

  frames.forEach((frame, index) => {
    const totalForFrame = computedTotals[index];
    if (typeof totalForFrame === 'number') {
      frame.score = totalForFrame;
    }
    const firstRoll = frame.rolls[0];
    const secondRoll = frame.rolls[1];
    if (frame.rolls.length === 1 && firstRoll?.pins === 10) {
      frame.isStrike = true;
      frame.isSpare = false;
    } else if (frame.rolls.length >= 2) {
      const pinSum = (firstRoll?.pins ?? 0) + (secondRoll?.pins ?? 0);
      frame.isStrike = firstRoll?.pins === 10;
      frame.isSpare = !frame.isStrike && pinSum === 10;
    }
  });

  const finalTotal = computedTotals[computedTotals.length - 1] ?? 0;
  tenthFrame.score = finalTotal;

  const mismatches: string[] = [];

  transcribedTotals.forEach((value, index) => {
    if (typeof value === 'number' && value !== computedTotals[index]) {
      mismatches.push(
        `frame ${index + 1}: printed total ${value} vs computed ${computedTotals[index]}`
      );
    }
  });

  if (
    typeof transcribedTenthTotal === 'number' &&
    transcribedTenthTotal !== computedTotals[computedTotals.length - 1]
  ) {
    mismatches.push(
      `frame 10: printed total ${transcribedTenthTotal} vs computed ${computedTotals[computedTotals.length - 1]}`
    );
  }

  for (let i = 1; i < computedTotals.length; i += 1) {
    const current = computedTotals[i];
    const previous = computedTotals[i - 1];
    if (typeof current === 'number' && typeof previous === 'number' && current < previous) {
      mismatches.push(
        `running totals decrease between frames ${i} and ${i + 1} (${computedTotals[i - 1]} -> ${computedTotals[i]})`
      );
    }
  }

  const issues = Array.from(new Set(mismatches)).map(
    (message) => `${playerName}: ${message}`
  );

  return { computedTotals, issues };
};

const convertToGame = (raw: ExtractionPayload | PlayerPayload): Game => {
  const rawFrames: RawFrame[] = Array.isArray(raw?.frames) ? (raw.frames as RawFrame[]) : [];

  const firstNineFrames = rawFrames
    .filter((frame) => {
      const frameNumber = Number(frame?.frameNumber);
      return Number.isFinite(frameNumber) ? frameNumber >= 1 && frameNumber <= 9 : true;
    })
    .slice(0, 9);

  const frames: Frame[] = firstNineFrames.map((frameData) => {
    const frame: Frame = {
      rolls: normalizeRolls(frameData?.rolls),
      isStrike: Boolean(frameData?.isStrike),
      isSpare: Boolean(frameData?.isSpare)
    };

    const runningTotal = Number.isFinite(frameData?.runningTotal)
      ? Number(frameData?.runningTotal)
      : undefined;

    if (runningTotal !== undefined) {
      frame.score = runningTotal;
    }

    return frame;
  });

  while (frames.length < 9) {
    frames.push({
      rolls: [{ pins: 0 }, { pins: 0 }],
      isStrike: false,
      isSpare: false,
      score: 0
    });
  }

  const tenthFrameSource: Partial<RawFrame> =
    (raw?.tenthFrame as Partial<RawFrame> | undefined) ??
    rawFrames.find((frame) => Number(frame?.frameNumber) === 10) ??
    rawFrames[9] ??
    {};

  const tenthFrameRolls = normalizeRolls((tenthFrameSource as RawFrame)?.rolls);

  const tenthFrame: TenthFrame = {
    rolls: tenthFrameRolls.length > 0 ? tenthFrameRolls : [{ pins: 0 }],
    isStrike: Boolean((tenthFrameSource as RawFrame)?.isStrike),
    isSpare: Boolean((tenthFrameSource as RawFrame)?.isSpare)
  };

  const tenthFrameScore =
    typeof tenthFrameSource?.runningTotal === 'number'
      ? Number(tenthFrameSource.runningTotal)
      : Number.isFinite(raw?.totalScore)
      ? Number(raw?.totalScore)
      : undefined;

  if (tenthFrameScore !== undefined) {
    tenthFrame.score = tenthFrameScore;
  }

  const totalScore = Number.isFinite(raw?.totalScore)
    ? Number(raw?.totalScore)
    : typeof tenthFrame.score === 'number'
    ? tenthFrame.score
    : 0;

  const transcribedTotals = firstNineFrames.map((frame) =>
    Number.isFinite(frame?.runningTotal) ? Number(frame?.runningTotal) : undefined
  );

  const transcribedTenthTotal =
    typeof tenthFrameSource?.runningTotal === 'number'
      ? Number(tenthFrameSource.runningTotal)
      : Number.isFinite(raw?.totalScore)
      ? Number(raw?.totalScore)
      : undefined;

  const playerName =
    typeof raw?.playerName === 'string' && raw.playerName.trim().length > 0
      ? raw.playerName.trim()
      : 'Unknown Player';

  const { computedTotals, issues: consistencyIssues } = enforceConsistency({
    playerName,
    frames,
    tenthFrame,
    transcribedTotals,
    ...(transcribedTenthTotal !== undefined ? { transcribedTenthTotal } : {})
  });

  const issues = [...consistencyIssues];

  const rawFrameCount = Array.isArray(raw?.frames) ? raw.frames.length : 0;
  if (rawFrameCount < 10) {
    issues.push(
      `${playerName}: extractor returned ${rawFrameCount} frame rows (expected 10)`
    );
  }

  const bestTotal = computedTotals[computedTotals.length - 1] ?? totalScore;

  let confidence = 1;
  if (rawFrameCount < 10) {
    confidence -= Math.min(0.3, (10 - rawFrameCount) * 0.05);
  }
  if (issues.length > 0) {
    confidence -= Math.min(0.8, issues.length * 0.15);
  }
  confidence = Math.max(0, Math.min(1, Number(confidence.toFixed(2))));

  const game: Game = {
    frames,
    tenthFrame,
    totalScore: bestTotal,
    playerName
  };

  if (issues.length > 0) {
    game.issues = issues;
  }

  if (Number.isFinite(confidence)) {
    game.confidence = confidence;
  }

  return game;
};

export const convertExtractionPayload = (data: ExtractionPayload): Game[] => {
  if (!data) {
    return [];
  }

  if (Array.isArray(data.players) && data.players.length > 0) {
    const players = data.players as NonNullable<ExtractionPayload['players']>;
    return players.map((playerPayload) => convertToGame(playerPayload));
  }

  if (data.playerName || data.frames) {
    return [convertToGame(data)];
  }

  return [];
};
