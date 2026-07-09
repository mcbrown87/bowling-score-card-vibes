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
const originalMatchMedia = window.matchMedia;

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

const buildAliceHistoryPage = (scores: number[]) => ({
  page: 1,
  pageSize: 50,
  totalImages: scores.length,
  totalPages: 1,
  images: scores.map((score, index) => ({
    id: `img-history-${index + 1}`,
    previewUrl: `/history-${index + 1}.jpg`,
    originalFileName: `alice-history-${index + 1}.jpg`,
    contentType: 'image/jpeg',
    sizeBytes: 1000,
    createdAt: `2026-04-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`,
    isProcessingEstimate: false,
    lastEstimateError: null,
    games: [buildGame('Alice', [8, 18, 30, 44, 60, 78, 98, 120, 144, score], score)]
  }))
});

beforeEach(() => {
  mockedLoadStoredImages.mockResolvedValue(buildStoredImagesPage());
  window.innerWidth = 1200;
  window.matchMedia = jest.fn().mockImplementation(() => ({
    matches: true,
    media: '(min-width: 768px) and (pointer: fine) and (hover: hover)',
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn()
  }));
});

afterEach(() => {
  jest.clearAllMocks();
  window.innerWidth = originalInnerWidth;
  window.matchMedia = originalMatchMedia;
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

  it('limits the selected player view when a recent-game filter is selected', async () => {
    render(<PlayerGamesBrowser />);

    await screen.findByText(/Viewing Alice/);

    fireEvent.change(screen.getByLabelText('Games shown'), { target: { value: '1' } });

    await waitFor(() => expect(screen.getByText('Showing: 1 of 2')).toBeVisible());
    expect(screen.getByText(/Viewing Alice — score 145/)).toBeVisible();
    expect(screen.getByText(/Source: alice-2.jpg/)).toBeVisible();
    expect(screen.queryByText(/Score 170/)).not.toBeInTheDocument();
  });

  it('shows a 3-game rolling average on the score timeline', async () => {
    render(<PlayerGamesBrowser />);

    await screen.findByText(/Viewing Alice/);

    expect(screen.getByText('3-game average')).toBeVisible();
    expect(screen.queryByText('Corrected')).not.toBeInTheDocument();
    expect(screen.queryByText('Estimate')).not.toBeInTheDocument();
    expect(screen.queryByText('Selected')).not.toBeInTheDocument();
    expect(screen.getByText('alice-1.jpg • Score 170 • 3-game avg 170')).toBeInTheDocument();
    expect(screen.getByText('alice-2.jpg • Score 145 • 3-game avg 158')).toBeInTheDocument();
  });

  it('recalculates the rolling average from visible games after filtering', async () => {
    render(<PlayerGamesBrowser />);

    await screen.findByText(/Viewing Alice/);

    fireEvent.change(screen.getByLabelText('Games shown'), { target: { value: '1' } });

    await waitFor(() =>
      expect(screen.getByText('alice-2.jpg • Score 145 • 3-game avg 145')).toBeInTheDocument()
    );
    expect(screen.queryByText('alice-2.jpg • Score 145 • 3-game avg 158')).not.toBeInTheDocument();
  });

  it('cycles the rolling average window from the chart legend', async () => {
    mockedLoadStoredImages.mockResolvedValue(buildAliceHistoryPage([100, 110, 120, 130, 140, 200]));

    render(<PlayerGamesBrowser />);

    await screen.findByText(/Viewing Alice/);

    expect(
      screen.getByText('alice-history-6.jpg • Score 200 • 3-game avg 157')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Current window is 3 games/i }));

    expect(screen.getByRole('button', { name: /Current window is 6 games/i })).toBeVisible();
    expect(
      screen.getByText('alice-history-6.jpg • Score 200 • 6-game avg 133')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('alice-history-6.jpg • Score 200 • 3-game avg 157')
    ).not.toBeInTheDocument();
  });

  it('toggles score and rolling average lines from the legend line controls', async () => {
    render(<PlayerGamesBrowser />);

    await screen.findByText(/Viewing Alice/);

    expect(screen.getByTestId('score-line')).toBeInTheDocument();
    expect(screen.getByTestId('rolling-average-line')).toBeInTheDocument();
    expect(screen.getByText('alice-1.jpg • Score 170 • 3-game avg 170')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide score line' }));

    expect(screen.queryByTestId('score-line')).not.toBeInTheDocument();
    expect(screen.getByTestId('rolling-average-line')).toBeInTheDocument();
    expect(
      screen.queryByText('alice-1.jpg • Score 170 • 3-game avg 170')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide rolling average line' }));

    expect(screen.queryByTestId('score-line')).not.toBeInTheDocument();
    expect(screen.queryByTestId('rolling-average-line')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show score line' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show rolling average line' }));

    expect(screen.getByTestId('score-line')).toBeInTheDocument();
    expect(screen.getByTestId('rolling-average-line')).toBeInTheDocument();
    expect(screen.getByText('alice-1.jpg • Score 170 • 3-game avg 170')).toBeInTheDocument();
  });

  it('loads every stored image page before grouping player games', async () => {
    mockedLoadStoredImages.mockImplementation(async (page = 1) => {
      if (page === 1) {
        return {
          ...buildStoredImagesPage(),
          totalImages: 4,
          totalPages: 2
        };
      }

      return {
        page: 2,
        pageSize: 50,
        totalImages: 4,
        totalPages: 2,
        images: [
          {
            id: 'img-a0',
            previewUrl: '/a0.jpg',
            originalFileName: 'alice-0.jpg',
            contentType: 'image/jpeg',
            sizeBytes: 1000,
            createdAt: '2026-03-30T12:00:00.000Z',
            isProcessingEstimate: false,
            lastEstimateError: null,
            games: [buildGame('Alice', [7, 17, 27, 37, 47, 57, 67, 77, 87, 97])]
          }
        ]
      };
    });

    render(<PlayerGamesBrowser />);

    await waitFor(() => expect(mockedLoadStoredImages).toHaveBeenCalledTimes(2));

    expect(mockedLoadStoredImages).toHaveBeenNthCalledWith(1, 1, 50);
    expect(mockedLoadStoredImages).toHaveBeenNthCalledWith(2, 2, 50);
    expect(await screen.findByText('2 players · 4 games')).toBeVisible();
    expect(screen.getByRole('button', { name: /Alice 3 games/i })).toBeVisible();
    expect(screen.getByLabelText('Games shown')).toHaveValue('0');
    expect(screen.getByText('Showing: 3')).toBeVisible();
  });

  it('shows a frame trend preview on hover for hover-capable layouts', async () => {
    render(<PlayerGamesBrowser />);

    await screen.findByText(/Viewing Alice/);

    const frameWrapper = screen.getByTestId('frame-box-1').parentElement;
    expect(frameWrapper).not.toBeNull();

    fireEvent.mouseEnter(frameWrapper as HTMLElement);

    expect(screen.getByTestId('frame-trend-preview-1')).toBeVisible();
  });

  it('does not show frame trend previews when hover is unavailable', async () => {
    window.matchMedia = jest.fn().mockImplementation(() => ({
      matches: false,
      media: '(min-width: 768px) and (pointer: fine) and (hover: hover)',
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn()
    }));

    render(<PlayerGamesBrowser />);

    await screen.findByText(/Viewing Alice/);

    const frameWrapper = screen.getByTestId('frame-box-1').parentElement;
    expect(frameWrapper).not.toBeNull();

    fireEvent.mouseEnter(frameWrapper as HTMLElement);

    expect(screen.queryByTestId('frame-trend-preview-1')).not.toBeInTheDocument();
  });
});
