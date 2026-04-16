import type { ProviderName, ProviderRequest, ProviderResult } from './types';
import { anthropicProvider } from './anthropicProvider';
import { localProvider } from './localProvider';
import { openaiProvider } from './openaiProvider';
import { stubProvider } from './stubProvider';

export const runProvider = async (
  provider: ProviderName,
  request: ProviderRequest
): Promise<ProviderResult> => {
  switch (provider) {
    case 'anthropic':
      return anthropicProvider(request);
    case 'openai':
      return openaiProvider(request);
    case 'local':
      return localProvider(request);
    case 'stub':
      return stubProvider(request);
    default:
      throw new Error(`Unsupported provider: ${provider as string}`);
  }
};
