import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { StoredImagesPanel } from './StoredImagesPanel';
import type { StoredImageSummary } from '@/types/stored-image';
import type { Game } from '@/types/bowling';

const originalMatchMedia = window.matchMedia;

const buildImageSummary = (): StoredImageSummary => ({
  id: 'image-1',
  previewUrl: '/test-preview.jpg',
  originalFileName: 'score.jpg',
  contentType: 'image/jpeg',
  sizeBytes: 1024,
  createdAt: '2026-04-05T12:00:00.000Z',
  isProcessingEstimate: false,
  lastEstimateError: null,
  games: [
    {
      id: 'game-1',
      gameIndex: 0,
      isEstimate: false,
      playerName: 'Player One',
      totalScore: 20,
      frames: Array.from({ length: 9 }, () => ({
        rolls: [{ pins: 1 }, { pins: 1 }],
        isStrike: false,
        isSpare: false,
        score: 2
      })),
      tenthFrame: {
        rolls: [{ pins: 1 }, { pins: 1 }, { pins: 0 }],
        isStrike: false,
        isSpare: false,
        score: 20
      }
    }
  ]
});

beforeEach(() => {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: query.includes('min-width: 768px'),
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn()
  }));
});

afterAll(() => {
  window.matchMedia = originalMatchMedia;
});

describe('StoredImagesPanel', () => {
  it('renders stored games on the desktop correction path without crashing', () => {
    render(
      <StoredImagesPanel
        images={[buildImageSummary()]}
        isLoading={false}
        error={null}
        onRetry={jest.fn()}
        onUpdateGame={jest.fn()}
      />
    );

    expect(screen.getByText('Corrections saved for this game')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Edit frame 1' })).toBeVisible();
  });

  it('allows selecting a frame in desktop mode and exposes keyboard editing state', () => {
    render(
      <StoredImagesPanel
        images={[buildImageSummary()]}
        isLoading={false}
        error={null}
        onRetry={jest.fn()}
        onUpdateGame={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit frame 1' }));

    expect(screen.getByRole('button', { name: 'Edit frame 1' })).toHaveAttribute(
      'aria-current',
      'step'
    );
    expect(screen.getByTestId('scorecard-root')).toBeVisible();
  });

  it('adds a new player score, saves it with the next game index, and opens rename', async () => {
    const onUpdateGame = jest.fn();

    const Harness = () => {
      const [images, setImages] = useState([buildImageSummary()]);

      return (
        <StoredImagesPanel
          images={images}
          isLoading={false}
          error={null}
          onRetry={jest.fn()}
          onUpdateGame={async (imageId: string, gameIndex: number, updatedGame: Game) => {
            onUpdateGame(imageId, gameIndex, updatedGame);
            setImages((prev) =>
              prev.map((image) =>
                image.id === imageId
                  ? {
                      ...image,
                      games: [
                        ...image.games,
                        {
                          ...updatedGame,
                          id: `game-${gameIndex}`,
                          gameIndex,
                          isEstimate: false
                        }
                      ]
                    }
                  : image
              )
            );
          }}
        />
      );
    };

    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Add player score' }));

    await waitFor(() => expect(onUpdateGame).toHaveBeenCalled());
    expect(onUpdateGame).toHaveBeenCalledWith(
      'image-1',
      1,
      expect.objectContaining({
        playerName: 'Player',
        totalScore: 0,
        isEstimate: false
      })
    );
    expect(await screen.findByRole('dialog', { name: 'Edit player name' })).toBeVisible();
    expect(screen.getByText('Game 2 of 2')).toBeVisible();
  });
});
