import { Frame, TenthFrame, FrameDisplay } from '../types/bowling';

export function formatFrameDisplay(frame: Frame, frameNumber: number): FrameDisplay {
  if (frame.isStrike) {
    return {
      roll1: '',
      roll2: 'X',
      frameScore: frame.score ?? null
    };
  }
  
  if (frame.isSpare) {
    return {
      roll1: frame.rolls[0].pins.toString(),
      roll2: '/',
      frameScore: frame.score ?? null
    };
  }
  
  const roll1 = frame.rolls[0]?.pins || 0;
  const roll2 = frame.rolls[1]?.pins || 0;
  
  return {
    roll1: roll1 === 0 ? '-' : roll1.toString(),
    roll2: roll2 === 0 ? '-' : roll2.toString(),
    frameScore: frame.score ?? null
  };
}

export function formatTenthFrameDisplay(tenthFrame: TenthFrame): FrameDisplay {
  const rolls = tenthFrame.rolls;
  let roll1 = '';
  let roll2 = '';
  let roll3 = '';
  
  if (rolls.length >= 1) {
    roll1 = rolls[0].pins === 10 ? 'X' : (rolls[0].pins === 0 ? '-' : rolls[0].pins.toString());
  }
  
  if (rolls.length >= 2) {
    if (rolls[0].pins === 10) {
      roll2 = rolls[1].pins === 10 ? 'X' : (rolls[1].pins === 0 ? '-' : rolls[1].pins.toString());
    } else {
      roll2 = rolls[0].pins + rolls[1].pins === 10 ? '/' : (rolls[1].pins === 0 ? '-' : rolls[1].pins.toString());
    }
  }
  
  if (rolls.length >= 3) {
    const firstRollPins = rolls[0]?.pins ?? 0;
    const secondRollPins = rolls[1]?.pins ?? 0;
    const thirdRollPins = rolls[2]?.pins ?? 0;

    const formatPins = (pins: number) => pins === 10 ? 'X' : (pins === 0 ? '-' : pins.toString());

    if (firstRollPins === 10) {
      if (secondRollPins === 10) {
        roll3 = formatPins(thirdRollPins);
      } else {
        roll3 = secondRollPins + thirdRollPins === 10 ? '/' : formatPins(thirdRollPins);
      }
    } else if (firstRollPins + secondRollPins === 10) {
      roll3 = formatPins(thirdRollPins);
    } else {
      roll3 = formatPins(thirdRollPins);
    }
  }
  
  return {
    roll1,
    roll2,
    roll3,
    frameScore: tenthFrame.score ?? null
  };
}
