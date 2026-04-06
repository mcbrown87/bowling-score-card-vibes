import type { Game } from '@/types/bowling';
import type { StoredGameSummary } from '@/types/stored-image';
import { recalculateGame } from './recalculateGame';

export const createEmptyGame = (playerName = 'Player'): Game =>
  recalculateGame({
    playerName,
    frames: Array.from({ length: 9 }, () => ({
      rolls: [{ pins: 0 }, { pins: 0 }],
      isStrike: false,
      isSpare: false,
      score: 0
    })),
    tenthFrame: {
      rolls: [{ pins: 0 }, { pins: 0 }],
      isStrike: false,
      isSpare: false,
      score: 0
    },
    totalScore: 0,
    isEstimate: false
  });

export const getNextGameIndex = (
  games: Array<Pick<StoredGameSummary, 'gameIndex'>>
): number => {
  if (games.length === 0) {
    return 0;
  }

  return Math.max(...games.map((game) => game.gameIndex)) + 1;
};

export const upsertStoredGameByIndex = (
  games: StoredGameSummary[],
  nextGame: StoredGameSummary
): StoredGameSummary[] => {
  const existingIndex = games.findIndex((game) => game.gameIndex === nextGame.gameIndex);
  const updated =
    existingIndex === -1
      ? [...games, nextGame]
      : games.map((game) => (game.gameIndex === nextGame.gameIndex ? nextGame : game));

  return [...updated].sort((left, right) => left.gameIndex - right.gameIndex);
};
