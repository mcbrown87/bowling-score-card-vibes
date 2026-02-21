import { fireEvent, render, screen } from '@testing-library/react';
import { FrameCorrectionModal } from './FrameCorrectionModal';
import { Game } from '../types/bowling';

const buildGame = (): Game => {
  const frames = Array.from({ length: 9 }, () => ({
    rolls: [{ pins: 0 }, { pins: 0 }],
    isStrike: false,
    isSpare: false,
    score: 0
  }));

  return {
    frames,
    tenthFrame: {
      rolls: [{ pins: 0 }, { pins: 0 }, { pins: 0 }],
      isStrike: false,
      isSpare: false,
      score: 0
    },
    totalScore: 0,
    playerName: 'Test Player'
  };
};

describe('FrameCorrectionModal', () => {
  it('applies strike for a regular frame and locks roll 2', () => {
    const onApply = jest.fn();
    const game = buildGame();

    render(
      <FrameCorrectionModal game={game} frameIndex={0} onApply={onApply} onClose={jest.fn()} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Strike (X)' }));

    const roll2Select = screen.getByRole('button', { name: 'Select roll 2 (0)' });
    expect(roll2Select).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onApply).toHaveBeenCalledTimes(1);
    const updated = onApply.mock.calls[0][0] as Game;
    expect(updated.frames[0].rolls).toEqual([{ pins: 10 }]);
    expect(updated.frames[0].isStrike).toBe(true);
    expect(updated.frames[0].isSpare).toBe(false);
  });

  it('fills a spare based on roll 1 and persists the frame', () => {
    const onApply = jest.fn();
    const game = buildGame();

    render(
      <FrameCorrectionModal game={game} frameIndex={0} onApply={onApply} onClose={jest.fn()} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Set roll1 to 7 pins' }));
    fireEvent.click(screen.getByRole('button', { name: 'Spare (/)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const updated = onApply.mock.calls[0][0] as Game;
    expect(updated.frames[0].rolls).toEqual([{ pins: 7 }, { pins: 3 }]);
    expect(updated.frames[0].isSpare).toBe(true);
  });

  it('unlocks roll 3 in frame 10 after a spare and saves third roll', () => {
    const onApply = jest.fn();
    const game = buildGame();

    render(
      <FrameCorrectionModal game={game} frameIndex={9} onApply={onApply} onClose={jest.fn()} />
    );

    const roll3Before = screen.getByRole('button', {
      name: 'Select roll 3 (0)'
    });
    expect(roll3Before).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Set roll1 to 6 pins' }));
    fireEvent.click(screen.getByRole('button', { name: 'Spare (/)' }));

    const roll3After = screen.getByRole('button', {
      name: 'Select roll 3 (0)'
    });
    expect(roll3After).toBeEnabled();

    fireEvent.click(roll3After);
    fireEvent.click(screen.getByRole('button', { name: 'Set roll3 to 7 pins' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const updated = onApply.mock.calls[0][0] as Game;
    expect(updated.tenthFrame.rolls).toEqual([{ pins: 6 }, { pins: 4 }, { pins: 7 }]);
  });
});
