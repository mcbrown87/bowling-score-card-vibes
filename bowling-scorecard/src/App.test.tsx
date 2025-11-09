import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { Game } from './types/bowling';
import { extractScoresFromImage } from './utils/scoreExtractor';

jest.mock('./utils/scoreExtractor');

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
});

const originalAutoLoadEnv = process.env.REACT_APP_ENABLE_AUTO_TEST_IMAGE;

beforeEach(() => {
  process.env.REACT_APP_ENABLE_AUTO_TEST_IMAGE = 'true';
  const sampleGames = [buildSampleGame('Player One', 60), buildSampleGame('Player Two', 40)];
  mockedExtractScores.mockResolvedValue({
    success: true,
    games: sampleGames,
    game: sampleGames[0]
  });

  const mockFetch = jest.fn(() =>
    Promise.resolve({
      blob: () => Promise.resolve('fake-blob')
    })
  );

  // @ts-expect-error override for testing
  global.fetch = mockFetch;
});

afterEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  if (originalAutoLoadEnv === undefined) {
    delete process.env.REACT_APP_ENABLE_AUTO_TEST_IMAGE;
  } else {
    process.env.REACT_APP_ENABLE_AUTO_TEST_IMAGE = originalAutoLoadEnv;
  }
});

test('renders scorecards after OCR extraction completes', async () => {
  render(<App />);

  await waitFor(() => expect(mockedExtractScores).toHaveBeenCalled());

  expect(await screen.findByText('Player One')).toBeInTheDocument();
  expect(await screen.findByText('Player Two')).toBeInTheDocument();
  expect(
    await screen.findByText(/Successfully extracted scores for 2 players/i)
  ).toBeInTheDocument();
});
