import type { ExtractionPayload } from '@/types/bowling';
import { convertExtractionPayload } from './convertExtractedData';

const regularFrames = Array.from({ length: 9 }, (_, index) => ({
  frameNumber: index + 1,
  rolls: [
    { pins: index === 0 ? 7 : 1, isSplit: index === 0 },
    { pins: index === 0 ? 2 : 1, isSplit: true }
  ],
  isStrike: false,
  isSpare: false,
  runningTotal: 0
}));

describe('convertExtractionPayload split metadata', () => {
  it('preserves split leaves only on valid rack-opening rolls', () => {
    const payload: ExtractionPayload = {
      success: true,
      failureReason: null,
      players: [
        {
          playerName: 'Split Tester',
          frames: regularFrames,
          tenthFrame: {
            rolls: [
              { pins: 10, isSplit: true },
              { pins: 7, isSplit: true },
              { pins: 2, isSplit: true }
            ],
            isStrike: true,
            isSpare: false,
            runningTotal: 0
          },
          totalScore: 0
        }
      ]
    };

    const [game] = convertExtractionPayload(payload);

    expect(game?.frames[0]?.rolls).toEqual([
      { pins: 7, isSplit: true },
      { pins: 2 }
    ]);
    expect(game?.frames[1]?.rolls).toEqual([{ pins: 1 }, { pins: 1 }]);
    expect(game?.tenthFrame.rolls).toEqual([
      { pins: 10 },
      { pins: 7, isSplit: true },
      { pins: 2 }
    ]);
  });
});
