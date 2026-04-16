import type { Prisma } from '@prisma/client';

import { prisma } from '@/server/db/client';
import type { ProviderName } from '@/server/providers/types';

const APP_CONFIG_KEY = 'runtime-settings';

export type RuntimeSettings = {
  activeProvider: ProviderName;
  openaiModel: string;
  anthropicModel: string;
  localModelArtifactId: string | null;
  localModelName: string;
  mlServiceUrl: string;
};

const envDefaultProvider = (process.env.DEFAULT_PROVIDER as ProviderName) ?? 'openai';

const defaultSettings: RuntimeSettings = {
  activeProvider: envDefaultProvider,
  openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o',
  anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-3-7-sonnet-latest',
  localModelArtifactId: null,
  localModelName: process.env.LOCAL_MODEL_NAME ?? 'donut-bowling-v1',
  mlServiceUrl: process.env.ML_SERVICE_URL ?? 'http://ml-service:8000'
};

const mergeSettings = (value: Prisma.JsonValue | null | undefined): RuntimeSettings => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaultSettings;
  }

  const incoming = value as Partial<RuntimeSettings>;
  return {
    activeProvider: incoming.activeProvider ?? defaultSettings.activeProvider,
    openaiModel: incoming.openaiModel ?? defaultSettings.openaiModel,
    anthropicModel: incoming.anthropicModel ?? defaultSettings.anthropicModel,
    localModelArtifactId: incoming.localModelArtifactId ?? defaultSettings.localModelArtifactId,
    localModelName: incoming.localModelName ?? defaultSettings.localModelName,
    mlServiceUrl: incoming.mlServiceUrl ?? defaultSettings.mlServiceUrl
  };
};

export async function getRuntimeSettings() {
  const record = await prisma.appConfig.findUnique({
    where: { key: APP_CONFIG_KEY }
  });

  return mergeSettings(record?.value);
}

export async function updateRuntimeSettings(partial: Partial<RuntimeSettings>) {
  const current = await getRuntimeSettings();
  const next = {
    ...current,
    ...partial
  };

  await prisma.appConfig.upsert({
    where: { key: APP_CONFIG_KEY },
    update: { value: next as unknown as Prisma.InputJsonValue },
    create: {
      key: APP_CONFIG_KEY,
      value: next as unknown as Prisma.InputJsonValue
    }
  });

  return next;
}

export async function getProviderModel(provider: ProviderName) {
  const settings = await getRuntimeSettings();

  switch (provider) {
    case 'anthropic':
      return settings.anthropicModel;
    case 'openai':
      return settings.openaiModel;
    case 'local':
      return settings.localModelName;
    case 'stub':
      return 'dev-stub';
  }
}
