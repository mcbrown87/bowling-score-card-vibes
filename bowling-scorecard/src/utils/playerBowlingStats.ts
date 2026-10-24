import type { Game } from '@/types/bowling';

export type PlayerBowlingStats = {
  strikePercentage: number;
  strikeCount: number;
  strikeOpportunities: number;
  spareConversionPercentage: number | null;
  spareConversions: number;
  spareOpportunities: number;
  splitConversionPercentage: number | null;
  splitConversions: number;
  splitLeaves: number;
  firstBallAverage: number;
  openFrames: number;
  longestStrikeRun: number;
};

type RackResult = {
  firstBallPins: number;
  isStrike: boolean;
  hasSpareOpportunity: boolean;
  convertedSpare: boolean;
  isSplitLeave: boolean;
  convertedSplit: boolean;
};

const pins = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(10, Math.max(0, Math.trunc(value)))
    : 0;

const regularRack = (rolls: Game['frames'][number]['rolls']): RackResult => {
  const firstBallPins = pins(rolls[0]?.pins);
  const secondBallPins = pins(rolls[1]?.pins);
  const isStrike = firstBallPins === 10;
  const isSplitLeave = Boolean(rolls[0]?.isSplit) && firstBallPins > 0 && firstBallPins < 10;
  const convertedSpare = !isStrike && firstBallPins + secondBallPins === 10;
  return {
    firstBallPins,
    isStrike,
    hasSpareOpportunity: !isStrike,
    convertedSpare,
    isSplitLeave,
    convertedSplit: isSplitLeave && convertedSpare
  };
};

export const calculatePlayerBowlingStats = (game: Game): PlayerBowlingStats => {
  const racks: RackResult[] = game.frames.slice(0, 9).map((frame) => regularRack(frame.rolls));
  let openFrames = racks.filter(
    (rack) => !rack.isStrike && !rack.convertedSpare
  ).length;

  const tenthRolls = game.tenthFrame.rolls.map((roll) => pins(roll.pins));
  const first = tenthRolls[0] ?? 0;
  const second = tenthRolls[1] ?? 0;
  const third = tenthRolls[2];
  const tenthFirstRack: RackResult = {
    firstBallPins: first,
    isStrike: first === 10,
    hasSpareOpportunity: first !== 10,
    convertedSpare: first !== 10 && first + second === 10,
    isSplitLeave: Boolean(game.tenthFrame.rolls[0]?.isSplit) && first > 0 && first < 10,
    convertedSplit:
      Boolean(game.tenthFrame.rolls[0]?.isSplit) &&
      first > 0 &&
      first < 10 &&
      first + second === 10
  };
  racks.push(tenthFirstRack);

  if (!tenthFirstRack.isStrike && !tenthFirstRack.convertedSpare) {
    openFrames += 1;
  }

  if (tenthFirstRack.isStrike) {
    const secondRack: RackResult = {
      firstBallPins: second,
      isStrike: second === 10,
      hasSpareOpportunity: second !== 10 && third !== undefined,
      convertedSpare: second !== 10 && third !== undefined && second + third === 10,
      isSplitLeave:
        Boolean(game.tenthFrame.rolls[1]?.isSplit) && second > 0 && second < 10,
      convertedSplit:
        Boolean(game.tenthFrame.rolls[1]?.isSplit) &&
        second > 0 &&
        second < 10 &&
        third !== undefined &&
        second + third === 10
    };
    racks.push(secondRack);

    if (secondRack.isStrike && third !== undefined) {
      racks.push({
        firstBallPins: third,
        isStrike: third === 10,
        hasSpareOpportunity: false,
        convertedSpare: false,
        isSplitLeave: false,
        convertedSplit: false
      });
    }
  } else if (tenthFirstRack.convertedSpare && third !== undefined) {
    racks.push({
      firstBallPins: third,
      isStrike: third === 10,
      hasSpareOpportunity: false,
      convertedSpare: false,
      isSplitLeave: false,
      convertedSplit: false
    });
  }

  const strikeCount = racks.filter((rack) => rack.isStrike).length;
  const spareOpportunities = racks.filter((rack) => rack.hasSpareOpportunity).length;
  const spareConversions = racks.filter((rack) => rack.convertedSpare).length;
  const splitLeaves = racks.filter((rack) => rack.isSplitLeave).length;
  const splitConversions = racks.filter((rack) => rack.convertedSplit).length;
  const firstBallTotal = racks.reduce((sum, rack) => sum + rack.firstBallPins, 0);
  let currentStrikeRun = 0;
  let longestStrikeRun = 0;

  racks.forEach((rack) => {
    if (rack.isStrike) {
      currentStrikeRun += 1;
      longestStrikeRun = Math.max(longestStrikeRun, currentStrikeRun);
    } else {
      currentStrikeRun = 0;
    }
  });

  return {
    strikePercentage: racks.length ? (strikeCount / racks.length) * 100 : 0,
    strikeCount,
    strikeOpportunities: racks.length,
    spareConversionPercentage:
      spareOpportunities > 0 ? (spareConversions / spareOpportunities) * 100 : null,
    spareConversions,
    spareOpportunities,
    splitConversionPercentage: splitLeaves > 0 ? (splitConversions / splitLeaves) * 100 : null,
    splitConversions,
    splitLeaves,
    firstBallAverage: racks.length ? firstBallTotal / racks.length : 0,
    openFrames,
    longestStrikeRun
  };
};
