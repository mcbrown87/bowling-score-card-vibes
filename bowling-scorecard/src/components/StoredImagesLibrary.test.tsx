import { render, screen, waitFor } from '@testing-library/react';
import { StoredImagesLibrary } from './StoredImagesLibrary';
import { loadStoredImages } from '@/utils/storedImages';

jest.mock('@/utils/storedImages', () => ({
  loadStoredImages: jest.fn(),
  normalizeStoredImage: jest.fn(),
  saveStoredGameCorrection: jest.fn()
}));

const mockedLoadStoredImages = loadStoredImages as jest.MockedFunction<typeof loadStoredImages>;

const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  mockedLoadStoredImages.mockResolvedValue([
    {
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
          playerName: 'Library Player',
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
    }
  ]);

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

describe('StoredImagesLibrary', () => {
  it('loads and renders stored images for the library view', async () => {
    render(<StoredImagesLibrary />);

    await waitFor(() => expect(mockedLoadStoredImages).toHaveBeenCalled());
    expect(await screen.findByText('Corrections saved for this game')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Edit frame 1' })).toBeVisible();
  });
});
