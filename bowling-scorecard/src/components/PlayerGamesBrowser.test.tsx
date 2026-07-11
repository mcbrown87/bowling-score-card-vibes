import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { PlayerGamesBrowser } from './PlayerGamesBrowser';
import { loadStoredImages } from '@/utils/storedImages';

const mockRouterPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush
  })
}));

jest.mock('@/utils/storedImages', () => ({
  loadStoredImages: jest.fn()
}));

const mockedLoadStoredImages = loadStoredImages as jest.MockedFunction<typeof loadStoredImages>;
const originalInnerWidth = window.innerWidth;
const originalMatchMedia = window.matchMedia;

const buildGame = (
  playerName: string,
  runningTotals: number[],
  totalScore = runningTotals[9],
  overrides: Record<string, unknown> = {}
) => ({
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
  },
  ...overrides
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
      team: null,
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
      team: null,
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
      team: null,
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
    team: null,
    originalFileName: `alice-history-${index + 1}.jpg`,
    contentType: 'image/jpeg',
    sizeBytes: 1000,
    createdAt: `2026-04-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`,
    isProcessingEstimate: false,
    lastEstimateError: null,
    games: [buildGame('Alice', [8, 18, 30, 44, 60, 78, 98, 120, 144, score], score)]
  }))
});

const buildTeamHistoryPage = () => ({
  page: 1,
  pageSize: 50,
  totalImages: 4,
  totalPages: 1,
  images: [
    {
      id: 'img-wednesday',
      previewUrl: '/wednesday.jpg',
      team: { id: 'team-1', name: 'Wednesday League' },
      originalFileName: 'wednesday.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1000,
      createdAt: '2026-04-04T12:00:00.000Z',
      isProcessingEstimate: false,
      lastEstimateError: null,
      games: [
        buildGame('Alice', [8, 18, 30, 44, 60, 78, 98, 120, 144, 170], 170, {
          player: { id: 'player-alice', name: 'Alice' }
        }),
        {
          ...buildGame('Bob', [20, 40, 49, 69, 78, 98, 107, 127, 136, 156], 156, {
            gameIndex: 1
          }),
          totalScore: 0
        }
      ]
    },
    {
      id: 'img-wednesday-older',
      previewUrl: '/wednesday-older.jpg',
      team: { id: 'team-1', name: 'Wednesday League' },
      originalFileName: 'wednesday-older.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1000,
      createdAt: '2026-04-01T12:00:00.000Z',
      isProcessingEstimate: false,
      lastEstimateError: null,
      games: [
        buildGame('Alicia', [7, 17, 27, 37, 47, 57, 67, 77, 87, 150], 150, {
          player: { id: 'player-alice', name: 'Alice' }
        }),
        buildGame('Charlie', [6, 16, 26, 36, 46, 56, 66, 76, 86, 120], 120, {
          gameIndex: 1
        })
      ]
    },
    {
      id: 'img-friday',
      previewUrl: '/friday.jpg',
      team: { id: 'team-2', name: 'Friday Night' },
      originalFileName: 'friday.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1000,
      createdAt: '2026-04-03T12:00:00.000Z',
      isProcessingEstimate: false,
      lastEstimateError: null,
      games: [buildGame('Alice', [9, 29, 38, 58, 67, 87, 96, 116, 125, 145])]
    },
    {
      id: 'img-unassigned',
      previewUrl: '/unassigned.jpg',
      team: null,
      originalFileName: 'unassigned.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1000,
      createdAt: '2026-04-02T12:00:00.000Z',
      isProcessingEstimate: false,
      lastEstimateError: null,
      games: [buildGame('Unassigned', [7, 17, 27, 37, 47, 57, 67, 77, 87, 97])]
    }
  ]
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
  mockRouterPush.mockClear();
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

  it('groups scorecards by team in team mode', async () => {
    mockedLoadStoredImages.mockResolvedValue(buildTeamHistoryPage());

    render(<PlayerGamesBrowser mode="teams" />);

    expect(await screen.findByText('Games by team')).toBeVisible();
    expect(screen.getByText('2 teams · 3 scorecards')).toBeVisible();
    const wednesdayButton = screen.getByRole('button', {
      name: /Wednesday League 2 scorecards/i
    });
    expect(wednesdayButton).toBeVisible();
    expect(screen.getByRole('button', { name: /Friday Night 1 scorecard/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /Wednesday League 2 scorecards Best: 326/i })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Unassigned/i })).not.toBeInTheDocument();
    expect(await screen.findByText(/Viewing Wednesday League — score 326/)).toBeVisible();
    expect(screen.queryByText('Frame heatmap')).not.toBeInTheDocument();
  });

  it('shows roster and analytics for the selected team', async () => {
    mockedLoadStoredImages.mockResolvedValue(buildTeamHistoryPage());

    render(<PlayerGamesBrowser mode="teams" />);

    expect(await screen.findByText('Team roster')).toBeVisible();

    const analytics = screen.getByLabelText('Team analytics');
    expect(within(analytics).getByText('Scorecards')).toBeVisible();
    expect(within(analytics).getByText('2')).toBeVisible();
    expect(within(analytics).getByText('Player games')).toBeVisible();
    expect(within(analytics).getByText('4')).toBeVisible();
    expect(within(analytics).getByText('Team average')).toBeVisible();
    expect(within(analytics).getByText('298')).toBeVisible();
    expect(within(analytics).getByText('Best team score')).toBeVisible();
    expect(within(analytics).getAllByText('326')[0]).toBeVisible();
    expect(within(analytics).getByText('Latest team score')).toBeVisible();

    const roster = screen.getByRole('table', { name: 'Team roster' });
    expect(within(roster).getByText('Alice')).toBeVisible();
    expect(within(roster).getByText('160')).toBeVisible();
    expect(within(roster).getByText('170')).toBeVisible();
    expect(within(roster).getByText('Bob')).toBeVisible();
    expect(within(roster).getByText('Charlie')).toBeVisible();
    expect(screen.queryByText('Alicia')).not.toBeInTheDocument();
  });

  it('updates the latest lineup when a different team scorecard is selected', async () => {
    mockedLoadStoredImages.mockResolvedValue(buildTeamHistoryPage());

    render(<PlayerGamesBrowser mode="teams" />);

    await screen.findByText(/Viewing Wednesday League — score 326/);
    expect(screen.getByText('Selected lineup')).toBeVisible();
    expect(within(screen.getByRole('table', { name: 'Selected lineup' })).getByText('Bob')).toBeVisible();

    fireEvent.click(screen.getByText('wednesday-older.jpg • Score 270 • 3-game avg 270 • std dev 0'));

    await waitFor(() => expect(screen.getByText(/Viewing Wednesday League — score 270/)).toBeVisible());
    const lineup = screen.getByRole('table', { name: 'Selected lineup' });
    expect(within(lineup).getByText('Charlie')).toBeVisible();
    expect(within(lineup).queryByText('Bob')).not.toBeInTheDocument();
  });

  it('summarizes team member performance by lineup spot', async () => {
    mockedLoadStoredImages.mockResolvedValue(buildTeamHistoryPage());

    render(<PlayerGamesBrowser mode="teams" />);

    expect(await screen.findByText('Lineup spot performance')).toBeVisible();

    const spotTable = screen.getByRole('table', { name: 'Lineup spot performance' });
    const aliceRow = within(spotTable).getByRole('row', { name: /Alice 160 \(2\) — Slot 1/i });
    expect(aliceRow).toBeVisible();
    expect(within(spotTable).getByRole('row', { name: /Bob — 156 \(1\) Slot 2/i })).toBeVisible();
    expect(within(spotTable).getByRole('row', { name: /Charlie — 120 \(1\) Slot 2/i })).toBeVisible();
    expect(screen.getByText('Values show average score with games in parentheses.')).toBeVisible();

    const strengthTable = screen.getByRole('table', { name: 'Slot strength' });
    expect(within(strengthTable).getByRole('row', { name: /Slot 1 160 2 Alice Alice/i })).toBeVisible();
    expect(within(strengthTable).getByRole('row', { name: /Slot 2 138 2 Bob Bob/i })).toBeVisible();
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
    expect(
      screen.getByText('alice-1.jpg • Score 170 • 3-game avg 170 • std dev 0')
    ).toBeInTheDocument();
    expect(
      screen.getByText('alice-2.jpg • Score 145 • 3-game avg 158 • std dev 13')
    ).toBeInTheDocument();
  });

  it('recalculates the rolling average from visible games after filtering', async () => {
    render(<PlayerGamesBrowser />);

    await screen.findByText(/Viewing Alice/);

    fireEvent.change(screen.getByLabelText('Games shown'), { target: { value: '1' } });

    await waitFor(() =>
      expect(
        screen.getByText('alice-2.jpg • Score 145 • 3-game avg 145 • std dev 0')
      ).toBeInTheDocument()
    );
    expect(
      screen.queryByText('alice-2.jpg • Score 145 • 3-game avg 158 • std dev 13')
    ).not.toBeInTheDocument();
  });

  it('cycles the rolling average window from the chart legend', async () => {
    mockedLoadStoredImages.mockResolvedValue(buildAliceHistoryPage([100, 110, 120, 130, 140, 200]));

    render(<PlayerGamesBrowser />);

    await screen.findByText(/Viewing Alice/);

    expect(
      screen.getByText('alice-history-6.jpg • Score 200 • 3-game avg 157 • std dev 31')
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Change rolling average window. Current window is 3 games.'
      })
    );

    expect(
      screen.getByRole('button', {
        name: 'Change rolling average window. Current window is 6 games.'
      })
    ).toBeVisible();
    expect(
      screen.getByText('alice-history-6.jpg • Score 200 • 6-game avg 133 • std dev 32')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('alice-history-6.jpg • Score 200 • 3-game avg 157 • std dev 31')
    ).not.toBeInTheDocument();
  });

  it('rounds score timeline y-axis ticks to whole scores', async () => {
    mockedLoadStoredImages.mockResolvedValue(buildAliceHistoryPage([122, 124, 109]));

    render(<PlayerGamesBrowser />);

    await screen.findByText(/Viewing Alice/);

    expect(screen.getByText('125')).toBeVisible();
    expect(screen.queryByText('124.98331244775333')).not.toBeInTheDocument();
  });

  it('toggles score, rolling average, and rolling standard deviation from the legend line controls', async () => {
    render(<PlayerGamesBrowser />);

    await screen.findByText(/Viewing Alice/);

    expect(screen.getByTestId('score-line')).toBeInTheDocument();
    expect(screen.getByTestId('rolling-average-line')).toBeInTheDocument();
    expect(screen.getByTestId('rolling-stddev-band')).toBeInTheDocument();
    expect(
      screen.getByText('alice-1.jpg • Score 170 • 3-game avg 170 • std dev 0')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide score line' }));

    expect(screen.queryByTestId('score-line')).not.toBeInTheDocument();
    expect(screen.getByTestId('rolling-average-line')).toBeInTheDocument();
    expect(screen.getByTestId('rolling-stddev-band')).toBeInTheDocument();
    expect(
      screen.queryByText('alice-1.jpg • Score 170 • 3-game avg 170 • std dev 0')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show rolling average only' }));

    expect(screen.queryByTestId('score-line')).not.toBeInTheDocument();
    expect(screen.getByTestId('rolling-average-line')).toBeInTheDocument();
    expect(screen.queryByTestId('rolling-stddev-band')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide rolling average' }));

    expect(screen.queryByTestId('score-line')).not.toBeInTheDocument();
    expect(screen.queryByTestId('rolling-average-line')).not.toBeInTheDocument();
    expect(screen.queryByTestId('rolling-stddev-band')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show score line' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Show rolling average and standard deviation' })
    );

    expect(screen.getByTestId('score-line')).toBeInTheDocument();
    expect(screen.getByTestId('rolling-average-line')).toBeInTheDocument();
    expect(screen.getByTestId('rolling-stddev-band')).toBeInTheDocument();
    expect(
      screen.getByText('alice-1.jpg • Score 170 • 3-game avg 170 • std dev 0')
    ).toBeInTheDocument();
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
            team: null,
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

  it('links player games to the source library page', async () => {
    mockedLoadStoredImages.mockImplementation(async (page = 1) => {
      if (page === 1) {
        return {
          page: 1,
          pageSize: 50,
          totalImages: 51,
          totalPages: 2,
          images: Array.from({ length: 50 }, (_, index) => ({
            id: `img-page-1-${index}`,
            previewUrl: `/page-1-${index}.jpg`,
            team: null,
            originalFileName: `page-1-${index}.jpg`,
            contentType: 'image/jpeg',
            sizeBytes: 1000,
            createdAt: `2026-03-01T12:${String(index).padStart(2, '0')}:00.000Z`,
            isProcessingEstimate: false,
            lastEstimateError: null,
            games: [
              buildGame(
                index === 0 ? 'Alice' : `Player ${index}`,
                [8, 18, 30, 44, 60, 78, 98, 120, 144, 170]
              )
            ]
          }))
        };
      }

      return {
        page: 2,
        pageSize: 50,
        totalImages: 51,
        totalPages: 2,
        images: [
          {
            id: 'img-target-page-2',
            previewUrl: '/target-page-2.jpg',
            team: null,
            originalFileName: 'target-page-2.jpg',
            contentType: 'image/jpeg',
            sizeBytes: 1000,
            createdAt: '2026-04-30T12:00:00.000Z',
            isProcessingEstimate: false,
            lastEstimateError: null,
            games: [buildGame('Alice', [9, 29, 38, 58, 67, 87, 96, 116, 125, 145])]
          }
        ]
      };
    });

    render(<PlayerGamesBrowser />);

    await screen.findByText(/Viewing Alice — score 145/);
    fireEvent.click(screen.getByRole('button', { name: 'Open this game in the library view' }));

    expect(mockRouterPush).toHaveBeenCalledWith(
      '/library?imageId=img-target-page-2&gameIndex=0&page=2'
    );
  });

  it('shows a frame trend preview on hover for hover-capable layouts', async () => {
    render(<PlayerGamesBrowser />);

    await screen.findByText(/Viewing Alice/);
    expect(screen.queryByText('3-game frame avg')).not.toBeInTheDocument();

    const frameWrapper = screen.getByTestId('frame-box-1').parentElement;
    expect(frameWrapper).not.toBeNull();

    fireEvent.mouseEnter(frameWrapper as HTMLElement);

    expect(screen.getByTestId('frame-trend-preview-1')).toBeVisible();
    expect(screen.getByTestId('frame-trend-raw-line-1')).toBeInTheDocument();
    expect(screen.getByTestId('frame-trend-average-line-1')).toBeInTheDocument();
  });

  it('applies the shared legend controls to frame trend previews', async () => {
    render(<PlayerGamesBrowser />);

    await screen.findByText(/Viewing Alice/);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Change rolling average window. Current window is 3 games.'
      })
    );

    expect(screen.getByText('6-game average')).toBeVisible();

    const frameWrapper = screen.getByTestId('frame-box-1').parentElement;
    expect(frameWrapper).not.toBeNull();

    fireEvent.mouseEnter(frameWrapper as HTMLElement);

    expect(screen.getByTestId('frame-trend-preview-1')).toBeVisible();
    expect(screen.getByText('6-game avg 9')).toBeVisible();
    expect(screen.getByTestId('frame-trend-raw-line-1')).toBeInTheDocument();
    expect(screen.getByTestId('frame-trend-average-line-1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide score line' }));

    expect(screen.getByTestId('frame-trend-preview-1')).toBeVisible();
    expect(screen.queryByTestId('frame-trend-raw-line-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('frame-trend-average-line-1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show rolling average only' }));

    expect(screen.getByTestId('frame-trend-preview-1')).toBeVisible();
    expect(screen.queryByTestId('frame-trend-raw-line-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('frame-trend-average-line-1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide rolling average' }));

    expect(screen.queryByTestId('frame-trend-preview-1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show score line' }));
    fireEvent.mouseEnter(frameWrapper as HTMLElement);
    expect(screen.getByTestId('frame-trend-preview-1')).toBeVisible();
    expect(screen.getByTestId('frame-trend-raw-line-1')).toBeInTheDocument();
    expect(screen.queryByTestId('frame-trend-average-line-1')).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Show rolling average and standard deviation' })
    );

    expect(screen.getByTestId('frame-trend-preview-1')).toBeVisible();
    expect(screen.getByTestId('frame-trend-raw-line-1')).toBeInTheDocument();
    expect(screen.getByTestId('frame-trend-average-line-1')).toBeInTheDocument();
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
    expect(screen.queryByText('3-game frame avg')).not.toBeInTheDocument();

    const frameWrapper = screen.getByTestId('frame-box-1').parentElement;
    expect(frameWrapper).not.toBeNull();

    fireEvent.mouseEnter(frameWrapper as HTMLElement);

    expect(screen.queryByTestId('frame-trend-preview-1')).not.toBeInTheDocument();
  });
});
