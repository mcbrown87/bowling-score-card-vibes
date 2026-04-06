import type { StoredGameSummary } from '@/types/stored-image';
import { createEmptyGame, getNextGameIndex, upsertStoredGameByIndex } from './gameCreation';

describe('gameCreation helpers', () => {
  it('creates an empty manual game with zeroed scores', () => {
    const game = createEmptyGame();

    expect(game.playerName).toBe('Player');
    expect(game.isEstimate).toBe(false);
    expect(game.frames).toHaveLength(9);
    expect(game.frames.every((frame) => frame.score === 0)).toBe(true);
    expect(game.tenthFrame.score).toBe(0);
    expect(game.totalScore).toBe(0);
  });

  it('chooses the next game index from the highest existing index', () => {
    const games = [
      { gameIndex: 0 },
      { gameIndex: 3 },
      { gameIndex: 1 }
    ] as Array<Pick<StoredGameSummary, 'gameIndex'>>;

    expect(getNextGameIndex(games)).toBe(4);
  });

  it('upserts stored games and keeps them sorted by game index', () => {
    const game = createEmptyGame();
    const nextGames = upsertStoredGameByIndex(
      [
        { ...game, gameIndex: 2, id: 'two' },
        { ...game, gameIndex: 0, id: 'zero' }
      ],
      { ...game, gameIndex: 1, id: 'one' }
    );

    expect(nextGames.map((entry) => entry.gameIndex)).toEqual([0, 1, 2]);
  });
});
