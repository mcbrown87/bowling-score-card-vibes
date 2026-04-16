import type { ProviderRequest, ProviderResult } from './types';
import { getRuntimeSettings } from '@/server/config/appConfig';
import { inferWithLocalModel } from '@/server/ml/client';

export async function localProvider({
  imageDataUrl,
  prompt,
  model
}: ProviderRequest): Promise<ProviderResult> {
  const settings = await getRuntimeSettings();
  const response = await inferWithLocalModel({
    imageDataUrl,
    prompt,
    model: model ?? settings.localModelName,
    modelArtifactId: settings.localModelArtifactId
  });

  return {
    rawText: response.rawText ?? '',
    games: Array.isArray(response.games) ? response.games : [],
    model: response.model ?? model ?? settings.localModelName
  };
}
