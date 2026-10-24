import type { Game } from '../types/bowling';
import { applyDesktopScoreKey, getFrameCorrectionState } from './frameCorrection';

const buildGame = (): Game => ({
  frames: Array.from({ length: 9 }, () => ({
    rolls: [{ pins: 0 }, { pins: 0 }],
    isStrike: false,
    isSpare: false,
    score: 0
  })),
  tenthFrame: {
    rolls: [{ pins: 0 }, { pins: 0 }, { pins: 0 }],
    isStrike: false,
    isSpare: false,
    score: 0
  },
  totalScore: 0,
  playerName: 'Test Player'
});

describe('applyDesktopScoreKey', () => {
  it('treats x as a strike and advances to the next frame for frames 1-9', () => {
    const result = applyDesktopScoreKey(buildGame(), 0, 'roll1', 'x');

    expect(result.changed).toBe(true);
    expect(result.frameIndex).toBe(1);
    expect(result.activeRoll).toBe('roll1');
    expect(result.game.frames[0].rolls).toEqual([{ pins: 10 }]);
    expect(result.game.frames[0].isStrike).toBe(true);
  });

  it('fills regular frames sequentially with numeric input', () => {
    const first = applyDesktopScoreKey(buildGame(), 0, 'roll1', '7');
    const second = applyDesktopScoreKey(first.game, first.frameIndex, first.activeRoll, '2');

    expect(first.activeRoll).toBe('roll2');
    expect(second.game.frames[0].rolls).toEqual([{ pins: 7 }, { pins: 2 }]);
    expect(second.frameIndex).toBe(1);
    expect(second.activeRoll).toBe('roll1');
  });

  it('moves arrow navigation throw-by-throw across frames', () => {
    const afterFirst = applyDesktopScoreKey(buildGame(), 0, 'roll1', '4');
    const movedRight = applyDesktopScoreKey(afterFirst.game, 0, afterFirst.activeRoll, 'ArrowRight');
    const movedLeft = applyDesktopScoreKey(afterFirst.game, 0, afterFirst.activeRoll, 'ArrowLeft');

    expect(movedRight.frameIndex).toBe(1);
    expect(movedRight.activeRoll).toBe('roll1');
    expect(movedLeft.frameIndex).toBe(0);
    expect(movedLeft.activeRoll).toBe('roll1');
  });

  it('skips disabled second rolls when navigating from a strike frame', () => {
    const afterStrike = applyDesktopScoreKey(buildGame(), 0, 'roll1', 'x');
    const movedLeft = applyDesktopScoreKey(afterStrike.game, 1, 'roll1', 'ArrowLeft');

    expect(afterStrike.frameIndex).toBe(1);
    expect(movedLeft.frameIndex).toBe(0);
    expect(movedLeft.activeRoll).toBe('roll1');
  });

  it('unlocks roll 3 in the tenth frame after a spare', () => {
    const first = applyDesktopScoreKey(buildGame(), 9, 'roll1', '6');
    const second = applyDesktopScoreKey(first.game, first.frameIndex, first.activeRoll, '4');
    const state = getFrameCorrectionState(second.game, 9);

    expect(second.activeRoll).toBe('roll3');
    expect(state.canEditRoll3).toBe(true);
  });

  it('clears the active roll with backspace', () => {
    const afterFirst = applyDesktopScoreKey(buildGame(), 0, 'roll1', '8');
    const afterSecond = applyDesktopScoreKey(afterFirst.game, 0, afterFirst.activeRoll, '1');
    const cleared = applyDesktopScoreKey(afterSecond.game, 0, 'roll2', 'Backspace');

    expect(cleared.game.frames[0].rolls).toEqual([{ pins: 8 }, { pins: 0 }]);
    expect(cleared.activeRoll).toBe('roll2');
  });

  it('toggles a split with s without moving the active roll', () => {
    const afterFirst = applyDesktopScoreKey(buildGame(), 0, 'roll1', '7');
    const tagged = applyDesktopScoreKey(afterFirst.game, 0, afterFirst.activeRoll, 's');

    expect(tagged.changed).toBe(true);
    expect(tagged.frameIndex).toBe(0);
    expect(tagged.activeRoll).toBe('roll2');
    expect(tagged.game.frames[0].rolls[0]).toEqual({ pins: 7, isSplit: true });

    const untagged = applyDesktopScoreKey(tagged.game, 0, tagged.activeRoll, 'S');
    expect(untagged.game.frames[0].rolls[0]).toEqual({ pins: 7 });
  });

  it('ignores split tagging for blank and strike rolls', () => {
    const blank = applyDesktopScoreKey(buildGame(), 0, 'roll1', 's');
    expect(blank.changed).toBe(false);

    const afterStrike = applyDesktopScoreKey(buildGame(), 0, 'roll1', 'x');
    const strike = applyDesktopScoreKey(afterStrike.game, 0, 'roll1', 's');
    expect(strike.changed).toBe(false);
    expect(strike.game.frames[0].rolls[0]).toEqual({ pins: 10 });
  });

  it('targets roll 2 for a tenth-frame split after an opening strike', () => {
    const afterStrike = applyDesktopScoreKey(buildGame(), 9, 'roll1', 'x');
    const afterSecond = applyDesktopScoreKey(
      afterStrike.game,
      afterStrike.frameIndex,
      afterStrike.activeRoll,
      '7'
    );
    const tagged = applyDesktopScoreKey(
      afterSecond.game,
      afterSecond.frameIndex,
      afterSecond.activeRoll,
      's'
    );

    expect(tagged.activeRoll).toBe('roll3');
    expect(tagged.game.tenthFrame.rolls[1]).toEqual({ pins: 7, isSplit: true });
    expect(tagged.game.tenthFrame.rolls[0]).toEqual({ pins: 10 });
  });
});
