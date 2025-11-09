import { Game } from '../types/bowling';

export interface ExtractionResult {
  success: boolean;
  games?: Game[]; // Support multiple games
  game?: Game;    // Keep for backward compatibility
  error?: string;
  rawText?: string;
}

export const extractScoresFromImage = async (imageFile: string | File): Promise<ExtractionResult> => {
  // Convert File to base64 data URL if needed
  let imageDataUrl: string;
  
  if (typeof imageFile === 'string') {
    imageDataUrl = imageFile;
  } else {
    // Convert File to base64
    imageDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(imageFile);
    });
  }

  try {
    const baseUrl = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:4000';
    // Emit diagnostic log so we can verify which endpoint the browser will call.
    // eslint-disable-next-line no-console
    console.info('extractScoresFromImage request', {
      baseUrl,
      payloadBytes: imageDataUrl.length
    });
    const response = await fetch(`${baseUrl}/api/extract-scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        imageDataUrl
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      const message = typeof data?.error === 'string' ? data.error : 'Failed to extract scores';
      return {
        success: false,
        error: message,
        rawText: data?.rawResponse
      };
    }

    const games: Game[] = Array.isArray(data.games) ? data.games : [];
    return {
      success: true,
      games,
      game: games[0],
      rawText: data.rawResponse
    };
  } catch (error) {
    return {
      success: false,
      error: `Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};
