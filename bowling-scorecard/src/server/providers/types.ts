import type { Game } from '@/types/bowling';

export interface ProviderRequest {
  imageDataUrl: string;
  prompt: string;
  model?: string;
}

export interface ProviderResult {
  rawText: string;
  games: Game[];
  model?: string;
}

export type ProviderName = 'anthropic' | 'openai' | 'local' | 'stub';
