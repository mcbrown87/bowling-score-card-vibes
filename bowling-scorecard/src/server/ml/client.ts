import type { Game } from '@/types/bowling';
import { getRuntimeSettings } from '@/server/config/appConfig';

type MlInferResponse = {
  model?: string;
  rawText?: string;
  games?: Game[];
};

const jsonHeaders = {
  'Content-Type': 'application/json'
};

export async function inferWithLocalModel(input: {
  imageDataUrl: string;
  prompt: string;
  model?: string;
  modelArtifactId?: string | null;
}) {
  const settings = await getRuntimeSettings();
  const response = await fetch(`${settings.mlServiceUrl}/infer`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(`Local model inference failed with status ${response.status}`);
  }

  return (await response.json()) as MlInferResponse;
}

export async function listLocalModels() {
  const settings = await getRuntimeSettings();
  const response = await fetch(`${settings.mlServiceUrl}/models`, {
    method: 'GET',
    headers: jsonHeaders
  });

  if (!response.ok) {
    throw new Error(`ML service model listing failed with status ${response.status}`);
  }

  return (await response.json()) as {
    models: Array<{
      id: string;
      name: string;
      version: string;
      architecture: string;
      localPath: string;
      metrics?: Record<string, unknown>;
    }>;
  };
}

export async function importLocalModelArtifact(file: File) {
  const settings = await getRuntimeSettings();
  const formData = new FormData();
  formData.set('file', file, file.name);

  const response = await fetch(`${settings.mlServiceUrl}/models/import`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      detail
        ? `ML service model import failed with status ${response.status}: ${detail}`
        : `ML service model import failed with status ${response.status}`
    );
  }

  return (await response.json()) as {
    success: boolean;
    model: {
      id: string;
      name: string;
      version: string;
      architecture: string;
      localPath: string;
      metrics?: Record<string, unknown>;
    };
  };
}
