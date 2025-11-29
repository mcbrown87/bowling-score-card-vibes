import type { ProviderRequest, ProviderResult } from './types';
import type { Game } from '@/types/bowling';

const devNames = ['Alex', 'Bailey', 'Casey', 'Devon', 'Emery', 'Frankie', 'Gray', 'Holland'];

export async function stubProvider(_request: ProviderRequest): Promise<ProviderResult> {
  const games = buildDevStubGames();
  return {
    rawText: JSON.stringify(games),
    games,
    model: 'dev-stub'
  };
}

function buildDevStubGames(): Game[] {
  const playerCount = randomInt(1, 4);
  return Array.from({ length: playerCount }, (_, index) => {
    const playerName = `${devNames[(index + randomInt(0, devNames.length - 1)) % devNames.length]} ${
      100 + randomInt(0, 899)
    }`;
    return generateRandomGame(playerName);
  });
}

function generateRandomGame(playerName: string): Game {
  const frames: Game['frames'] = [];
  const rolls: number[] = [];

  for (let i = 0; i < 9; i += 1) {
    const firstRoll = randomInt(0, 10);
    if (firstRoll === 10) {
      frames.push({
        rolls: [{ pins: 10 }],
        isStrike: true,
        isSpare: false,
        score: 0
      });
      rolls.push(10);
    } else {
      const secondRoll = randomInt(0, 10 - firstRoll);
      const isSpare = firstRoll + secondRoll === 10;
      frames.push({
        rolls: [
          { pins: firstRoll },
          { pins: secondRoll }
        ],
        isStrike: false,
        isSpare,
        score: 0
      });
      rolls.push(firstRoll, secondRoll);
    }
  }

  const tenthRolls: number[] = [];
  const tenthFirst = randomInt(0, 10);
  if (tenthFirst === 10) {
    const second = randomInt(0, 10);
    const third = second === 10 ? randomInt(0, 10) : randomInt(0, 10 - second);
    tenthRolls.push(10, second, third);
  } else {
    const second = randomInt(0, 10 - tenthFirst);
    tenthRolls.push(tenthFirst, second);
    if (tenthFirst + second === 10) {
      tenthRolls.push(randomInt(0, 10));
    }
  }
  rolls.push(...tenthRolls);

  const tenthFrame = {
    rolls: tenthRolls.map((pins) => ({ pins })),
    isStrike: tenthRolls[0] === 10,
    isSpare: tenthRolls[0] !== 10 && (tenthRolls[0] ?? 0) + (tenthRolls[1] ?? 0) === 10,
    score: 0
  };

  let rollIndex = 0;
  let runningTotal = 0;
  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    const frame = frames[frameIndex];
    let frameScore: number;
    if (frame.isStrike) {
      frameScore = 10 + (rolls[rollIndex + 1] ?? 0) + (rolls[rollIndex + 2] ?? 0);
      rollIndex += 1;
    } else if (frame.isSpare) {
      frameScore = 10 + (rolls[rollIndex + 2] ?? 0);
      rollIndex += 2;
    } else {
      frameScore = (rolls[rollIndex] ?? 0) + (rolls[rollIndex + 1] ?? 0);
      rollIndex += 2;
    }
    runningTotal += frameScore;
    frame.score = runningTotal;
  }

  const tenthTotal = tenthRolls.reduce((sum, pins) => sum + pins, 0);
  runningTotal += tenthTotal;
  tenthFrame.score = runningTotal;

  return {
    frames,
    tenthFrame,
    totalScore: runningTotal,
    playerName
  };
}

function randomInt(min: number, max: number) {
  const clampedMin = Math.ceil(min);
  const clampedMax = Math.floor(max);
  return Math.floor(Math.random() * (clampedMax - clampedMin + 1)) + clampedMin;
}
