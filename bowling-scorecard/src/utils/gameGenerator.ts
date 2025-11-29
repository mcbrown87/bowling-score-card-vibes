import { Game, Frame, TenthFrame } from '../types/bowling';

export function generateRandomGame(playerName: string = 'Player'): Game {
  const frames: Frame[] = [];
  
  for (let i = 0; i < 9; i++) {
    frames.push(generateRandomFrame());
  }
  
  const tenthFrame = generateRandomTenthFrame();
  const totalScore = calculateTotalScore(frames, tenthFrame);
  
  return {
    frames,
    tenthFrame,
    totalScore,
    playerName
  };
}

function generateRandomFrame(): Frame {
  const firstRoll = Math.floor(Math.random() * 11);
  
  if (firstRoll === 10) {
    return {
      rolls: [{ pins: 10 }],
      isStrike: true,
      isSpare: false
    };
  }
  
  const maxSecondRoll = 10 - firstRoll;
  const secondRoll = Math.floor(Math.random() * (maxSecondRoll + 1));
  const isSpare = firstRoll + secondRoll === 10;
  
  return {
    rolls: [{ pins: firstRoll }, { pins: secondRoll }],
    isStrike: false,
    isSpare
  };
}

function generateRandomTenthFrame(): TenthFrame {
  const firstRoll = Math.floor(Math.random() * 11);
  
  if (firstRoll === 10) {
    const secondRoll = Math.floor(Math.random() * 11);
    if (secondRoll === 10) {
      const thirdRoll = Math.floor(Math.random() * 11);
      return {
        rolls: [{ pins: firstRoll }, { pins: secondRoll }, { pins: thirdRoll }],
        isStrike: true,
        isSpare: false
      };
    } else {
      const maxThirdRoll = 10 - secondRoll;
      const thirdRoll = Math.floor(Math.random() * (maxThirdRoll + 1));
      return {
        rolls: [{ pins: firstRoll }, { pins: secondRoll }, { pins: thirdRoll }],
        isStrike: true,
        isSpare: secondRoll + thirdRoll === 10
      };
    }
  }
  
  const maxSecondRoll = 10 - firstRoll;
  const secondRoll = Math.floor(Math.random() * (maxSecondRoll + 1));
  const isSpare = firstRoll + secondRoll === 10;
  
  if (isSpare) {
    const thirdRoll = Math.floor(Math.random() * 11);
    return {
      rolls: [{ pins: firstRoll }, { pins: secondRoll }, { pins: thirdRoll }],
      isStrike: false,
      isSpare: true
    };
  }
  
  return {
    rolls: [{ pins: firstRoll }, { pins: secondRoll }],
    isStrike: false,
    isSpare: false
  };
}

function calculateTotalScore(frames: Frame[], tenthFrame: TenthFrame): number {
  let totalScore = 0;
  
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    let frameScore = 0;
    
    if (frame.isStrike) {
      frameScore = 10;
      if (i === 8) {
        frameScore += tenthFrame.rolls[0]?.pins || 0;
        frameScore += tenthFrame.rolls[1]?.pins || 0;
      } else {
        const nextFrame = frames[i + 1];
        if (nextFrame.isStrike) {
          frameScore += 10;
          if (i === 7) {
            frameScore += tenthFrame.rolls[0]?.pins || 0;
          } else {
            frameScore += frames[i + 2]?.rolls[0]?.pins || 0;
          }
        } else {
          frameScore += nextFrame.rolls[0]?.pins || 0;
          frameScore += nextFrame.rolls[1]?.pins || 0;
        }
      }
    } else if (frame.isSpare) {
      frameScore = 10;
      if (i === 8) {
        frameScore += tenthFrame.rolls[0]?.pins || 0;
      } else {
        frameScore += frames[i + 1]?.rolls[0]?.pins || 0;
      }
    } else {
      frameScore = (frame.rolls[0]?.pins || 0) + (frame.rolls[1]?.pins || 0);
    }
    
    frame.score = totalScore + frameScore;
    totalScore += frameScore;
  }
  
  const tenthFrameScore = tenthFrame.rolls.reduce((sum, roll) => sum + roll.pins, 0);
  tenthFrame.score = totalScore + tenthFrameScore;
  totalScore += tenthFrameScore;
  
  return totalScore;
}
