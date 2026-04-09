import type { Game } from '@/types/bowling';
import { recalculateGame } from '@/utils/recalculateGame';

const HEATMAP_BASELINE_INTENSITY = 0.18;
const HEATMAP_MIN_INTENSITY = 0.12;
const HEATMAP_MAX_INTENSITY = 0.78;
const HEATMAP_CONTRAST_EXPONENT = 0.72;
const FRAME_COUNT = 10;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const getRunningTotals = (game: Game): number[] => {
  const storedTotals = game.frames.map((frame) => frame.score);
  storedTotals.push(game.tenthFrame.score ?? game.totalScore);

  if (storedTotals.length === FRAME_COUNT && storedTotals.every((value) => isFiniteNumber(value))) {
    return storedTotals as number[];
  }

  const normalizedGame = recalculateGame(game);
  const totals = normalizedGame.frames.map((frame) => frame.score ?? 0);
  totals.push(normalizedGame.tenthFrame.score ?? normalizedGame.totalScore ?? 0);
  return totals.slice(0, FRAME_COUNT);
};

export const getFrameGains = (game: Game): number[] => {
  const totals = getRunningTotals(game);
  return totals.map((total, index) => total - (index > 0 ? totals[index - 1] ?? 0 : 0));
};

export const getAverageFrameGains = (games: Game[]): number[] => {
  if (games.length === 0) {
    return Array.from({ length: FRAME_COUNT }, () => 0);
  }

  const totals = Array.from({ length: FRAME_COUNT }, () => 0);

  games.forEach((game) => {
    getFrameGains(game).forEach((gain, index) => {
      totals[index] += gain;
    });
  });

  return totals.map((total) => total / games.length);
};

export const buildFrameTrendSeries = (games: Game[]): number[][] => {
  const series = Array.from({ length: FRAME_COUNT }, () => [] as number[]);

  games.forEach((game) => {
    getFrameGains(game).forEach((gain, index) => {
      series[index]?.push(gain);
    });
  });

  return series;
};

export const normalizeFrameHeatmap = (averages: number[]): number[] => {
  const normalizedAverages = averages
    .slice(0, FRAME_COUNT)
    .map((value) => (isFiniteNumber(value) ? value : 0));

  while (normalizedAverages.length < FRAME_COUNT) {
    normalizedAverages.push(0);
  }

  const min = Math.min(...normalizedAverages);
  const max = Math.max(...normalizedAverages);

  if (max === min) {
    return normalizedAverages.map(() => HEATMAP_BASELINE_INTENSITY);
  }

  const range = max - min;
  return normalizedAverages.map((value) => {
    const scaled = (value - min) / range;
    const emphasized = Math.pow(scaled, HEATMAP_CONTRAST_EXPONENT);
    return (
      HEATMAP_MIN_INTENSITY +
      emphasized * (HEATMAP_MAX_INTENSITY - HEATMAP_MIN_INTENSITY)
    );
  });
};

export const buildPlayerFrameHeatmap = (games: Game[]): number[] =>
  normalizeFrameHeatmap(getAverageFrameGains(games));
