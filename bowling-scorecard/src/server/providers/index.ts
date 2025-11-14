import type { ProviderName, ProviderRequest, ProviderResult } from './types';
import { anthropicProvider } from './anthropicProvider';
import { openaiProvider } from './openaiProvider';

export const runProvider = async (
  provider: ProviderName,
  request: ProviderRequest
): Promise<ProviderResult> => {
  switch (provider) {
    case 'anthropic':
      return anthropicProvider(request);
    case 'openai':
      return openaiProvider(request);
    default:
      throw new Error(`Unsupported provider: ${provider as string}`);
  }
};
