import type { Game } from '@/types/bowling';

export interface ProviderRequest {
  imageDataUrl: string;
  prompt: string;
}

export interface ProviderResult {
  rawText: string;
  games: Game[];
}

export type ProviderName = 'anthropic' | 'openai';
