import type { Game, TenthFrame } from '@/types/bowling';
import { calculatePlayerBowlingStats } from './playerBowlingStats';

const openFrame = (first = 4, second = 4) => ({
  rolls: [{ pins: first }, { pins: second }],
  isStrike: false,
  isSpare: false
});

const buildGame = (tenthFrame: TenthFrame, frames = Array.from({ length: 9 }, () => openFrame())): Game => ({
  playerName: 'Tester',
  totalScore: 0,
  frames,
  tenthFrame
});

describe('calculatePlayerBowlingStats', () => {
  it('derives regular-frame strikes, spares, first balls, opens, and strike runs', () => {
    const frames = [
      { rolls: [{ pins: 10 }], isStrike: true, isSpare: false },
      { rolls: [{ pins: 10 }], isStrike: true, isSpare: false },
      { rolls: [{ pins: 7 }, { pins: 3 }], isStrike: false, isSpare: true },
      ...Array.from({ length: 6 }, () => openFrame())
    ];
    const stats = calculatePlayerBowlingStats(buildGame({
      rolls: [{ pins: 4 }, { pins: 4 }],
      isStrike: false,
      isSpare: false
    }, frames));

    expect(stats).toMatchObject({
      strikeCount: 2,
      strikeOpportunities: 10,
      spareConversions: 1,
      spareOpportunities: 8,
      openFrames: 7,
      longestStrikeRun: 2
    });
    expect(stats.strikePercentage).toBe(20);
    expect(stats.spareConversionPercentage).toBe(12.5);
    expect(stats.firstBallAverage).toBe(5.5);
  });

  it('counts all twelve full-rack strike opportunities in a perfect game', () => {
    const strike = { rolls: [{ pins: 10 }], isStrike: true, isSpare: false };
    const stats = calculatePlayerBowlingStats(buildGame({
      rolls: [{ pins: 10 }, { pins: 10 }, { pins: 10 }],
      isStrike: true,
      isSpare: false
    }, Array.from({ length: 9 }, () => strike)));

    expect(stats).toMatchObject({
      strikePercentage: 100,
      strikeCount: 12,
      strikeOpportunities: 12,
      spareConversionPercentage: null,
      spareOpportunities: 0,
      firstBallAverage: 10,
      openFrames: 0,
      longestStrikeRun: 12
    });
  });

  it('treats X 7 / as a fill-ball spare opportunity without adding an open frame', () => {
    const stats = calculatePlayerBowlingStats(buildGame({
      rolls: [{ pins: 10 }, { pins: 7 }, { pins: 3 }],
      isStrike: true,
      isSpare: false
    }));

    expect(stats.strikeOpportunities).toBe(11);
    expect(stats.spareOpportunities).toBe(10);
    expect(stats.spareConversions).toBe(1);
    expect(stats.openFrames).toBe(9);
    expect(stats.longestStrikeRun).toBe(1);
  });

  it('treats a tenth-frame spare fill ball as a fresh-rack strike opportunity', () => {
    const stats = calculatePlayerBowlingStats(buildGame({
      rolls: [{ pins: 9 }, { pins: 1 }, { pins: 10 }],
      isStrike: false,
      isSpare: true
    }));

    expect(stats.strikeOpportunities).toBe(11);
    expect(stats.strikeCount).toBe(1);
    expect(stats.spareConversions).toBe(1);
    expect(stats.openFrames).toBe(9);
  });
});
