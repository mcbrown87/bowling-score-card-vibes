import {
  BOWLING_EXTRACTION_PROMPT,
  getBowlingExtractionPrompt,
  LEAGUE_GAME_PLAYER_COUNT
} from './bowling';

describe('bowling extraction prompts', () => {
  it('does not contain scorecard-specific player names or totals', () => {
    expect(BOWLING_EXTRACTION_PROMPT).not.toContain('M.C.B.');
    expect(BOWLING_EXTRACTION_PROMPT).not.toContain('29, 49, 68');
  });

  it('requires every player row for a league game', () => {
    const prompt = getBowlingExtractionPrompt(true);

    expect(prompt).toContain(`exactly ${LEAGUE_GAME_PLAYER_COUNT} player score rows`);
    expect(prompt).toContain(`Extract all ${LEAGUE_GAME_PLAYER_COUNT} players`);
    expect(prompt).toContain('Do not stop after the first complete player');
  });

  it('does not append league requirements to a standard scorecard', () => {
    expect(getBowlingExtractionPrompt(false)).toBe(BOWLING_EXTRACTION_PROMPT);
  });
});
