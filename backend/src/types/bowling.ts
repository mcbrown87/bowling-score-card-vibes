export interface Roll {
  pins: number;
}

export interface Frame {
  rolls: Roll[];
  isStrike: boolean;
  isSpare: boolean;
  score?: number;
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

export interface ExtractionPayload {
  players?: Array<{
    playerName?: string;
    frames?: any[];
    tenthFrame?: any;
    totalScore?: number;
  }>;
  playerName?: string;
  frames?: any[];
  tenthFrame?: any;
  totalScore?: number;
}
