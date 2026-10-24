export interface Roll {
  pins: number;
  isSplit?: boolean;
}

export interface Frame {
  rolls: Roll[];
  score?: number;
  isStrike: boolean;
  isSpare: boolean;
}

export interface TenthFrame extends Omit<Frame, 'rolls'> {
  rolls: Roll[];
}

export interface Game {
  frames: Frame[];
  tenthFrame: TenthFrame;
  totalScore: number;
  playerName: string;
  isEstimate?: boolean;
}

export type FrameDisplay = {
  roll1: string;
  roll2: string;
  roll3?: string;
  splitRolls?: boolean[];
  frameScore: number | null;
};

export interface ExtractionPayload {
  success?: boolean;
  failureReason?: string | null;
  players?: Array<{
    playerName?: string;
    frames?: unknown[];
    tenthFrame?: unknown;
    totalScore?: number;
  }>;
  playerName?: string;
  frames?: unknown[];
  tenthFrame?: unknown;
  totalScore?: number;
}
