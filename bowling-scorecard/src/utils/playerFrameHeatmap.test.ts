import type { Game } from '@/types/bowling';
import {
  buildFrameTrendSeries,
  buildPlayerFrameHeatmap,
  getAverageFrameGains,
  getFrameGains,
  normalizeFrameHeatmap
} from '@/utils/playerFrameHeatmap';

const buildGameFromRunningTotals = (
  playerName: string,
  runningTotals: number[],
  regularFrames: Array<Partial<Game['frames'][number]>> = []
): Game => ({
  playerName,
  totalScore: runningTotals[9] ?? 0,
  frames: Array.from({ length: 9 }, (_, index) => {
    const overrides = regularFrames[index] ?? {};
    return {
      rolls: overrides.rolls ?? [{ pins: 4 }, { pins: 4 }],
      isStrike: overrides.isStrike ?? false,
      isSpare: overrides.isSpare ?? false,
      score: runningTotals[index]
    };
  }),
  tenthFrame: {
    rolls: [{ pins: 4 }, { pins: 4 }, { pins: 0 }],
    isStrike: false,
    isSpare: false,
    score: runningTotals[9]
  }
});

describe('playerFrameHeatmap', () => {
  it('computes per-frame gains from running totals', () => {
    const game = buildGameFromRunningTotals('Test', [9, 29, 38, 58, 67, 87, 96, 116, 125, 145]);

    expect(getFrameGains(game)).toEqual([9, 20, 9, 20, 9, 20, 9, 20, 9, 20]);
  });

  it('handles strike, spare, and tenth-frame gain calculations', () => {
    const game = buildGameFromRunningTotals(
      'Marks',
      [20, 40, 49, 69, 78, 98, 107, 127, 136, 156],
      [
        { rolls: [{ pins: 10 }], isStrike: true },
        { rolls: [{ pins: 10 }], isStrike: true },
        { rolls: [{ pins: 4 }, { pins: 5 }] },
        { rolls: [{ pins: 7 }, { pins: 3 }], isSpare: true }
      ]
    );

    expect(getFrameGains(game)).toEqual([20, 20, 9, 20, 9, 20, 9, 20, 9, 20]);
  });

  it('averages frame gains across multiple games', () => {
    const games = [
      buildGameFromRunningTotals('A', [9, 29, 38, 58, 67, 87, 96, 116, 125, 145]),
      buildGameFromRunningTotals('A', [8, 18, 30, 44, 60, 78, 98, 120, 144, 170])
    ];

    expect(getAverageFrameGains(games)).toEqual([8.5, 15, 10.5, 17, 12.5, 19, 14.5, 21, 16.5, 23]);
  });

  it('builds per-frame trend series from ordered games', () => {
    const games = [
      buildGameFromRunningTotals('A', [9, 29, 38, 58, 67, 87, 96, 116, 125, 145]),
      buildGameFromRunningTotals('A', [8, 18, 30, 44, 60, 78, 98, 120, 144, 170])
    ];

    const series = buildFrameTrendSeries(games);

    expect(series).toHaveLength(10);
    expect(series[0]).toEqual([9, 8]);
    expect(series[1]).toEqual([20, 10]);
    expect(series[9]).toEqual([20, 26]);
  });

  it('returns a low neutral baseline when every frame average is equal', () => {
    expect(normalizeFrameHeatmap(Array.from({ length: 10 }, () => 12))).toEqual(
      Array.from({ length: 10 }, () => 0.18)
    );
  });

  it('uses a nonlinear scale so midrange frame differences stay more visible', () => {
    const heatmap = normalizeFrameHeatmap([0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);

    expect(heatmap[5]).toBeGreaterThan(0.48);
    expect(heatmap[5]).toBeLessThan(0.78);
  });

  it('builds a 10-frame normalized heatmap for a player', () => {
    const heatmap = buildPlayerFrameHeatmap([
      buildGameFromRunningTotals('A', [8, 18, 30, 44, 60, 78, 98, 120, 144, 170])
    ]);

    expect(heatmap).toHaveLength(10);
    expect(heatmap[0]).toBeCloseTo(0.12);
    expect(heatmap[9]).toBeCloseTo(0.78);
  });
});
