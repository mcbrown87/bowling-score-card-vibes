import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StoredImagesLibrary } from './StoredImagesLibrary';
import { loadStoredImages } from '@/utils/storedImages';

jest.mock('@/utils/storedImages', () => ({
  loadStoredImages: jest.fn(),
  normalizeStoredImage: jest.fn(),
  saveStoredGameCorrection: jest.fn()
}));

const mockedLoadStoredImages = loadStoredImages as jest.MockedFunction<typeof loadStoredImages>;

const originalMatchMedia = window.matchMedia;
const buildPage = (page: number, totalPages = 2) => ({
  images: [
    {
      id: `image-${page}`,
      previewUrl: '/test-preview.jpg',
      originalFileName: `score-${page}.jpg`,
      contentType: 'image/jpeg',
      sizeBytes: 1024,
      createdAt: '2026-04-05T12:00:00.000Z',
      isProcessingEstimate: false,
      lastEstimateError: null,
      games: [
        {
          id: `game-${page}`,
          gameIndex: 0,
          isEstimate: false,
          playerName: `Library Player ${page}`,
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
  ],
  page,
  pageSize: 50,
  totalImages: 75,
  totalPages
});

beforeEach(() => {
  mockedLoadStoredImages.mockResolvedValue(buildPage(1));

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
    expect(screen.getByText('Page 1 of 2 · 75 uploads')).toBeVisible();
  });

  it('loads the next page when pagination is used', async () => {
    mockedLoadStoredImages
      .mockResolvedValueOnce(buildPage(1))
      .mockResolvedValueOnce(buildPage(2));

    render(<StoredImagesLibrary />);

    await screen.findByText('Page 1 of 2 · 75 uploads');
    fireEvent.click(screen.getByRole('button', { name: 'Next Page' }));

    await waitFor(() => expect(mockedLoadStoredImages).toHaveBeenLastCalledWith(2, 50));
    expect(await screen.findByText('Page 2 of 2 · 75 uploads')).toBeVisible();
  });
});
