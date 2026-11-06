import type { Game } from './bowling';

export type BowlingTeamSummary = {
  id: string;
  name: string;
};

export type TeamRosterStatusMap = Record<string, Record<string, boolean>>;

export type StoredImageTeamUpdate = {
  teamId?: string | null;
  teamName?: string;
  opponentTeamId?: string | null;
  opponentTeamName?: string;
  isLeagueGame?: boolean;
};

export type StoredGamePayload = {
  id?: string;
  gameIndex?: number;
  isEstimate?: boolean;
  player?: {
    id: string;
    name: string;
  } | null;
  playerName?: string | null;
  team?: BowlingTeamSummary | null;
  teamId?: string | null;
  totalScore?: number | null;
  frames?: unknown;
  tenthFrame?: unknown;
};

export type StoredGameSummary = Game & {
  id?: string;
  gameIndex: number;
  isEstimate: boolean;
  player?: {
    id: string;
    name: string;
  } | null;
  team: BowlingTeamSummary | null;
};

export type StoredImagePayload = {
  id: string;
  bucket?: string;
  objectKey?: string;
  team?: BowlingTeamSummary | null;
  opponentTeam?: BowlingTeamSummary | null;
  isLeagueGame?: boolean;
  originalFileName?: string | null;
  contentType?: string | null;
  sizeBytes?: number | null;
  createdAt?: string | Date;
  previewUrl?: string;
  games?: Array<StoredGamePayload | Game>;
  isProcessingEstimate?: boolean;
  lastEstimateError?: string | null;
};

export type StoredImageSummary = {
  id: string;
  previewUrl: string;
  team: BowlingTeamSummary | null;
  opponentTeam: BowlingTeamSummary | null;
  isLeagueGame: boolean;
  originalFileName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  games: StoredGameSummary[];
  isProcessingEstimate: boolean;
  lastEstimateError: string | null;
};

export type StoredImagesPage = {
  images: StoredImageSummary[];
  page: number;
  pageSize: number;
  totalImages: number;
  totalPages: number;
  canEdit: boolean;
};
