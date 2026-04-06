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

  it('marks the selected frame for desktop keyboard editing', () => {
    render(
      <Scorecard
        game={buildGame()}
        onFrameSelect={jest.fn()}
        selectedFrameIndex={2}
        activeRoll="roll2"
        keyboardMode
        keyboardActive
      />
    );

    expect(screen.getByRole('button', { name: 'Edit frame 3' })).toHaveAttribute(
      'aria-current',
      'step'
    );
    expect(screen.getByTestId('frame-roll-3-2')).toHaveAttribute('data-active-roll', 'true');
  });

  it('highlights the visible strike cell for the active roll', () => {
    const strikeGame: Game = {
      ...buildGame(),
      frames: [
        {
          rolls: [{ pins: 10 }],
          isStrike: true,
          isSpare: false,
          score: 10
        },
        ...buildGame().frames.slice(1)
      ]
    };

    render(
      <Scorecard
        game={strikeGame}
        onFrameSelect={jest.fn()}
        selectedFrameIndex={0}
        activeRoll="roll1"
        keyboardMode
        keyboardActive
      />
    );

    expect(screen.getByTestId('frame-roll-1-2')).toHaveAttribute('data-active-roll', 'true');
  });

  it('forwards keyboard events from the scorecard root', () => {
    const onKeyboardKeyDown = jest.fn();

    render(
      <Scorecard
        game={buildGame()}
        onFrameSelect={jest.fn()}
        onKeyboardKeyDown={onKeyboardKeyDown}
      />
    );

    fireEvent.keyDown(screen.getByTestId('scorecard-root'), { key: 'ArrowRight' });

    expect(onKeyboardKeyDown).toHaveBeenCalled();
  });
});
