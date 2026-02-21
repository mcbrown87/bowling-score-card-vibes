import { fireEvent, render, screen } from '@testing-library/react';
import { Scorecard } from './Scorecard';
import { Game } from '../types/bowling';

const buildGame = (): Game => {
  const frames = Array.from({ length: 9 }, (_, index) => ({
    rolls: [{ pins: 5 }, { pins: 4 }],
    isStrike: false,
    isSpare: false,
    score: (index + 1) * 9
  }));

  return {
    frames,
    tenthFrame: {
      rolls: [{ pins: 9 }, { pins: 1 }, { pins: 8 }],
      isStrike: false,
      isSpare: true,
      score: 89
    },
    totalScore: 89,
    playerName: 'Player A'
  };
};

describe('Scorecard', () => {
  it('calls onFrameSelect when an editable frame is clicked', () => {
    const onFrameSelect = jest.fn();

    render(<Scorecard game={buildGame()} onFrameSelect={onFrameSelect} compact />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit frame 3' }));

    expect(onFrameSelect).toHaveBeenCalledWith(2);
  });

  it('does not call onFrameSelect when editing is disabled', () => {
    const onFrameSelect = jest.fn();

    render(
      <Scorecard game={buildGame()} onFrameSelect={onFrameSelect} disableEditing compact />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit frame 3' }));

    expect(onFrameSelect).not.toHaveBeenCalled();
  });
});
