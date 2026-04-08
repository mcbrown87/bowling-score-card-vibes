import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PlayerGamesBrowser } from './PlayerGamesBrowser';
import { loadStoredImages } from '@/utils/storedImages';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn()
  })
}));

jest.mock('@/utils/storedImages', () => ({
  loadStoredImages: jest.fn()
}));

const mockedLoadStoredImages = loadStoredImages as jest.MockedFunction<typeof loadStoredImages>;
const originalInnerWidth = window.innerWidth;

const buildGame = (playerName: string, runningTotals: number[], totalScore = runningTotals[9]) => ({
  gameIndex: 0,
  isEstimate: false,
  playerName,
  totalScore,
  frames: Array.from({ length: 9 }, (_, index) => ({
    rolls: [{ pins: 4 }, { pins: 4 }],
    isStrike: false,
    isSpare: false,
    score: runningTotals[index]
  })),
  tenthFrame: {
    rolls: [{ pins: 4 }, { pins: 4 }, { pins: 0 }],
    isStrike: false,
    isSpare: false,
    score: totalScore
  }
});

const buildStoredImagesPage = () => ({
  page: 1,
  pageSize: 50,
  totalImages: 3,
  totalPages: 1,
  images: [
    {
      id: 'img-a1',
      previewUrl: '/a1.jpg',
      originalFileName: 'alice-1.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1000,
      createdAt: '2026-04-01T12:00:00.000Z',
      isProcessingEstimate: false,
      lastEstimateError: null,
      games: [buildGame('Alice', [8, 18, 30, 44, 60, 78, 98, 120, 144, 170])]
    },
    {
      id: 'img-a2',
      previewUrl: '/a2.jpg',
      originalFileName: 'alice-2.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1000,
      createdAt: '2026-04-03T12:00:00.000Z',
      isProcessingEstimate: false,
      lastEstimateError: null,
      games: [buildGame('Alice', [9, 29, 38, 58, 67, 87, 96, 116, 125, 145])]
    },
    {
      id: 'img-b1',
      previewUrl: '/b1.jpg',
      originalFileName: 'bob-1.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1000,
      createdAt: '2026-04-02T12:00:00.000Z',
      isProcessingEstimate: false,
      lastEstimateError: null,
      games: [buildGame('Bob', [20, 40, 49, 69, 78, 98, 107, 127, 136, 156])]
    }
  ]
});

beforeEach(() => {
  mockedLoadStoredImages.mockResolvedValue(buildStoredImagesPage());
  window.innerWidth = 1200;
});

afterEach(() => {
  jest.clearAllMocks();
  window.innerWidth = originalInnerWidth;
});

describe('PlayerGamesBrowser', () => {
  it('renders a player heatmap on the selected scorecard', async () => {
    render(<PlayerGamesBrowser />);

    await waitFor(() => expect(mockedLoadStoredImages).toHaveBeenCalled());

    expect(await screen.findByText('Frame heatmap')).toBeVisible();
    expect(screen.getByTestId('frame-box-1')).toHaveAttribute('data-heat-intensity', '0.12');
    expect(screen.getByTestId('frame-box-10')).toHaveAttribute('data-heat-intensity', '0.78');
  });

  it('recomputes the heatmap when a different player is selected', async () => {
    render(<PlayerGamesBrowser />);

    await screen.findByText(/Viewing Alice/);
    fireEvent.click(screen.getByRole('button', { name: /Bob/i }));

    await waitFor(() => expect(screen.getByText(/Viewing Bob/)).toBeVisible());
    expect(screen.getByTestId('frame-box-1')).toHaveAttribute('data-heat-intensity', '0.78');
    expect(screen.getByTestId('frame-box-3')).toHaveAttribute('data-heat-intensity', '0.12');
  });
});
