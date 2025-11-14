export interface Roll {
  pins: number;
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
  issues?: string[];
  confidence?: number;
}

export type FrameDisplay = {
  roll1: string;
  roll2: string;
  roll3?: string;
  frameScore: number | null;
};

export interface ExtractionPayload {
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
