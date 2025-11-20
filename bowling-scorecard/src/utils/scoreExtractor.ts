import { Game } from '../types/bowling';
import { resolveApiBaseUrl } from './api';

export interface ExtractionResult {
  success: boolean;
  games?: Game[]; // Support multiple games
  game?: Game;    // Keep for backward compatibility
  error?: string;
  rawText?: string;
  normalizedImageDataUrl?: string;
  storedImage?: {
    id: string;
    bucket: string;
    objectKey: string;
  };
  endpoint?: string;
  status?: number;
}

export const extractScoresFromImage = async (imageFile: string | File): Promise<ExtractionResult> => {
  // Convert File to base64 data URL if needed
  let imageDataUrl: string;
  let fileName: string | undefined;
  
  if (typeof imageFile === 'string') {
    imageDataUrl = imageFile;
  } else {
    fileName = imageFile.name;
    // Convert File to base64
    imageDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(imageFile);
    });
  }

  const baseUrl = resolveApiBaseUrl();
  const endpoint = `${baseUrl}/api/extract-scores`;

  try {
    // Emit diagnostic log so we can verify which endpoint the browser will call.
    // eslint-disable-next-line no-console
    console.info('extractScoresFromImage request', {
      baseUrl,
      payloadBytes: imageDataUrl.length
    });
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        imageDataUrl,
        fileName
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      const message = typeof data?.error === 'string' ? data.error : 'Failed to extract scores';
      return {
        success: false,
        error: message,
        rawText: data?.rawResponse,
        endpoint,
        status: response.status
      };
    }

    const games: Game[] = Array.isArray(data.games) ? data.games : [];
    return {
      success: true,
      games,
      game: games[0],
      rawText: data.rawResponse,
      normalizedImageDataUrl:
        typeof data.normalizedImageDataUrl === 'string' ? data.normalizedImageDataUrl : undefined,
      storedImage:
        data.storedImage && typeof data.storedImage === 'object'
          ? {
              id: data.storedImage.id,
              bucket: data.storedImage.bucket,
              objectKey: data.storedImage.objectKey
            }
          : undefined,
      endpoint,
      status: response.status
    };
  } catch (error) {
    return {
      success: false,
      error: `Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      endpoint
    };
  }
};
