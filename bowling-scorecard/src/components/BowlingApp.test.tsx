import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BowlingApp from './BowlingApp';
import { Game } from '../types/bowling';
import { extractScoresFromImage } from '../utils/scoreExtractor';

jest.mock('../utils/scoreExtractor');

const mockedExtractScores = extractScoresFromImage as jest.MockedFunction<typeof extractScoresFromImage>;

const buildSampleGame = (playerName: string, baseScore: number): Game => {
  const frames = Array.from({ length: 9 }, (_, index) => {
    const firstRollPins = index % 2 === 0 ? 10 : 7;
    const secondRollPins = firstRollPins === 10 ? 0 : 2;
    const isStrike = firstRollPins === 10;
    const isSpare = !isStrike && firstRollPins + secondRollPins === 10;

    return {
      rolls: isStrike ? [{ pins: 10 }] : [{ pins: firstRollPins }, { pins: secondRollPins }],
      isStrike,
      isSpare,
      score: baseScore + (index + 1) * 10
    };
  });

  const tenthFrameStrike = {
    rolls: [{ pins: 10 }, { pins: 10 }, { pins: 10 }],
    isStrike: true,
    isSpare: false,
    score: baseScore + 120
  };

  return {
    frames,
    tenthFrame: tenthFrameStrike,
    totalScore: tenthFrameStrike.score ?? baseScore + 120,
    playerName
  };
};

const originalFileReader = global.FileReader;
const originalFetch = global.fetch;

class MockFileReader {
  public onload: ((event: { target: { result: string } }) => void) | null = null;

  readAsDataURL(): void {
    setTimeout(() => {
      this.onload?.({ target: { result: 'data:image/jpeg;base64,testing' } });
    }, 0);
  }
}

beforeAll(() => {
  // @ts-expect-error override for testing
  global.FileReader = MockFileReader;
});

afterAll(() => {
  global.FileReader = originalFileReader;
  global.fetch = originalFetch;
});

beforeEach(() => {
  const sampleGames = [buildSampleGame('Player One', 60), buildSampleGame('Player Two', 40)];
  mockedExtractScores.mockResolvedValue({
    success: true,
    games: sampleGames,
    game: sampleGames[0]
  });

  const mockFetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          images: []
        })
    })
  );

  // @ts-expect-error override for testing
  global.fetch = mockFetch;
});

afterEach(() => {
  jest.clearAllMocks();
});

test('renders scorecards after OCR extraction completes', async () => {
  render(<BowlingApp />);

  const input = screen.getByLabelText('Upload scorecard');
  const fakeFile = new File(['fake-bowling'], 'score.jpg', { type: 'image/jpeg' });
  fireEvent.change(input, { target: { files: [fakeFile] } });

  await waitFor(() => expect(mockedExtractScores).toHaveBeenCalled());

  const playerOneBadges = await screen.findAllByText('Player One');
  const playerTwoBadges = await screen.findAllByText('Player Two');

  expect(playerOneBadges.length).toBeGreaterThan(0);
  expect(playerTwoBadges.length).toBeGreaterThan(0);
});
