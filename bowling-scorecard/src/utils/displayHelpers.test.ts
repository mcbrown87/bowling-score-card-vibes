import { formatFrameDisplay, formatTenthFrameDisplay } from './displayHelpers';
import { Frame, TenthFrame } from '../types/bowling';

describe('formatFrameDisplay', () => {
  it('shows dashes for gutter balls and keeps a zero frame score', () => {
    const frame: Frame = {
      rolls: [{ pins: 0 }, { pins: 0 }],
      isStrike: false,
      isSpare: false,
      score: 0
    };

    const display = formatFrameDisplay(frame, 1);

    expect(display).toEqual({
      roll1: '-',
      roll2: '-',
      frameScore: 0
    });
  });
});

describe('formatTenthFrameDisplay', () => {
  const baseTenthFrame: TenthFrame = {
    rolls: [],
    isStrike: false,
    isSpare: false
  };

  it('renders strike, number, spare for X 7 / sequences', () => {
    const tenthFrame: TenthFrame = {
      ...baseTenthFrame,
      rolls: [{ pins: 10 }, { pins: 7 }, { pins: 3 }],
      isStrike: true,
      score: 300
    };

    const display = formatTenthFrameDisplay(tenthFrame);

    expect(display).toEqual({
      roll1: 'X',
      roll2: '7',
      roll3: '/',
      frameScore: 300
    });
  });

  it('renders triple strike correctly', () => {
    const tenthFrame: TenthFrame = {
      ...baseTenthFrame,
      rolls: [{ pins: 10 }, { pins: 10 }, { pins: 10 }],
      isStrike: true,
      score: 300
    };

    expect(formatTenthFrameDisplay(tenthFrame)).toEqual({
      roll1: 'X',
      roll2: 'X',
      roll3: 'X',
      frameScore: 300
    });
  });

  it('renders spare followed by strike', () => {
    const tenthFrame: TenthFrame = {
      ...baseTenthFrame,
      rolls: [{ pins: 7 }, { pins: 3 }, { pins: 10 }],
      isSpare: true,
      score: 170
    };

    expect(formatTenthFrameDisplay(tenthFrame)).toEqual({
      roll1: '7',
      roll2: '/',
      roll3: 'X',
      frameScore: 170
    });
  });
});
