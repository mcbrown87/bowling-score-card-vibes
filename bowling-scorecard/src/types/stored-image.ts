import type { Game } from './bowling';

export type StoredGamePayload = {
  id?: string;
  playerName?: string | null;
  totalScore?: number | null;
  frames?: unknown;
  tenthFrame?: unknown;
  issues?: unknown;
  confidence?: number | null;
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
};

export type StoredImageSummary = {
  id: string;
  previewUrl: string;
  originalFileName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  games: Game[];
};
