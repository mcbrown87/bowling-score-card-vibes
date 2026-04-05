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
const buildImage = (page: number, index: number) => ({
  id: `image-page-${page}-${index + 1}`,
  previewUrl: '/test-preview.jpg',
  originalFileName: `score-page-${page}-${index + 1}.jpg`,
  contentType: 'image/jpeg',
  sizeBytes: 1024,
  createdAt: '2026-04-05T12:00:00.000Z',
  isProcessingEstimate: false,
  lastEstimateError: null,
  games: [
    {
      id: `game-page-${page}-${index + 1}`,
      gameIndex: 0,
      isEstimate: false,
      playerName: `Library Player ${page}-${index + 1}`,
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

const buildPage = (page: number, imageCount = 50, totalPages = 2) => ({
  images: Array.from({ length: imageCount }, (_, index) => buildImage(page, index)),
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
    expect(screen.getByText('Image 1 of 75')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Next Page' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Previous Page' })).not.toBeInTheDocument();
  });

  it('continues across page boundaries with the same previous and next image controls', async () => {
    mockedLoadStoredImages
      .mockResolvedValueOnce(buildPage(1, 50))
      .mockResolvedValueOnce(buildPage(2, 25))
      .mockResolvedValueOnce(buildPage(1, 50));

    render(<StoredImagesLibrary />);

    await screen.findByText('Image 1 of 75');

    for (let index = 0; index < 50; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Next →' }));
    }

    await waitFor(() => expect(mockedLoadStoredImages).toHaveBeenLastCalledWith(2, 50));
    expect(await screen.findByText('Image 51 of 75')).toBeVisible();
    expect(screen.getByAltText('Uploaded scorecard score-page-2-1.jpg')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '← Previous' }));

    await waitFor(() => expect(mockedLoadStoredImages).toHaveBeenLastCalledWith(1, 50));
    expect(await screen.findByText('Image 50 of 75')).toBeVisible();
    expect(screen.getByAltText('Uploaded scorecard score-page-1-50.jpg')).toBeVisible();
  });
});
