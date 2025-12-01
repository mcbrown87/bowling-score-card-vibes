import type { Game } from './bowling';

export type StoredGamePayload = {
  id?: string;
  gameIndex?: number;
  isEstimate?: boolean;
  playerName?: string | null;
  totalScore?: number | null;
  frames?: unknown;
  tenthFrame?: unknown;
};

export type StoredGameSummary = Game & {
  id?: string;
  gameIndex: number;
  isEstimate: boolean;
};

export type StoredImagePayload = {
  id: string;
  bucket?: string;
  objectKey?: string;
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
  originalFileName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  games: StoredGameSummary[];
  isProcessingEstimate: boolean;
  lastEstimateError: string | null;
};
