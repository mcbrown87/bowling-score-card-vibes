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

  it('passes optional frame heatmap values through to the frame boxes', () => {
    render(
      <Scorecard
        game={buildGame()}
        frameHeatmap={[0.12, 0.2, 0.28, 0.36, 0.44, 0.52, 0.6, 0.68, 0.76, 0.78]}
        compact
      />
    );

    expect(screen.getByTestId('frame-box-1')).toHaveAttribute('data-heat-intensity', '0.12');
    expect(screen.getByTestId('frame-box-10')).toHaveAttribute('data-heat-intensity', '0.78');
  });

  it('shows a frame trend preview on hover when enabled', () => {
    render(
      <Scorecard
        game={buildGame()}
        frameTrendSeries={[
          [9, 8, 10],
          [20, 10, 12],
          [9, 12, 14],
          [20, 14, 16],
          [9, 16, 18],
          [20, 18, 20],
          [9, 20, 22],
          [20, 22, 24],
          [9, 24, 26],
          [20, 26, 28]
        ]}
        selectedTrendIndex={1}
        showFrameTrendPreview
        compact
      />
    );

    const frameWrapper = screen.getByTestId('frame-box-1').parentElement;
    expect(frameWrapper).not.toBeNull();

    fireEvent.mouseEnter(frameWrapper as HTMLElement);

    expect(screen.getByTestId('frame-trend-preview-1')).toBeVisible();
    expect(screen.getByLabelText('Frame 1 trend preview')).toBeVisible();
  });

  it('does not show a frame trend preview when disabled', () => {
    render(
      <Scorecard
        game={buildGame()}
        frameTrendSeries={Array.from({ length: 10 }, () => [8, 9, 10])}
        compact
      />
    );

    const frameWrapper = screen.getByTestId('frame-box-1').parentElement;
    expect(frameWrapper).not.toBeNull();

    fireEvent.mouseEnter(frameWrapper as HTMLElement);

    expect(screen.queryByTestId('frame-trend-preview-1')).not.toBeInTheDocument();
  });
});
