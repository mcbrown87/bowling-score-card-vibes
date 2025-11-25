import type {
  StoredGamePayload,
  StoredImagePayload,
  StoredImageSummary,
  StoredGameSummary
} from '@/types/stored-image';
import type { Game } from '@/types/bowling';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isValidFrameArray = (value: unknown): value is Game['frames'] =>
  Array.isArray(value) && value.every((frame) => isRecord(frame));

const isValidTenthFrame = (value: unknown): value is Game['tenthFrame'] =>
  isRecord(value) && Array.isArray((value as { rolls?: unknown }).rolls);

const normalizeIssues = (issues: unknown): string[] | undefined => {
  if (!Array.isArray(issues)) {
    return undefined;
  }
  const normalized = issues.filter((issue): issue is string => typeof issue === 'string');
  return normalized.length > 0 ? normalized : undefined;
};

const normalizeStoredGame = (
  game: StoredGamePayload | Game | undefined,
  fallbackIndex = 0
): StoredGameSummary | null => {
  if (!game) {
    return null;
  }

  const frames = isValidFrameArray(game.frames) ? (game.frames as Game['frames']) : null;
  const tenthFrame = isValidTenthFrame(game.tenthFrame ?? null)
    ? (game.tenthFrame as Game['tenthFrame'])
    : null;

  if (!frames || !tenthFrame) {
    return null;
  }

  const playerName =
    typeof game.playerName === 'string' && game.playerName.trim().length > 0
      ? game.playerName
      : 'Unnamed player';

  return {
    id: (game as StoredGamePayload)?.id,
    gameIndex:
      typeof (game as StoredGamePayload)?.gameIndex === 'number'
        ? (game as StoredGamePayload).gameIndex ?? fallbackIndex
        : fallbackIndex,
    isEstimate: Boolean((game as StoredGamePayload)?.isEstimate ?? true),
    frames,
    tenthFrame,
    totalScore: typeof game.totalScore === 'number' ? game.totalScore : 0,
    playerName,
    issues: normalizeIssues(game.issues),
    confidence: typeof game.confidence === 'number' ? game.confidence : undefined
  };
};

export const normalizeStoredImage = (
  image: StoredImagePayload | null | undefined
): StoredImageSummary | null => {
  if (!image?.id) {
    return null;
  }

  const createdAt =
    typeof image.createdAt === 'string'
      ? image.createdAt
      : image?.createdAt instanceof Date
        ? image.createdAt.toISOString()
        : new Date().toISOString();

  const normalizedGames = Array.isArray(image.games)
    ? image.games
        .map((game, index) =>
          normalizeStoredGame(game as StoredGamePayload | Game | undefined, index)
        )
        .filter((game): game is StoredGameSummary => Boolean(game))
    : [];

  return {
    id: image.id,
    previewUrl: image.previewUrl ?? `/api/stored-images/${image.id}/content`,
    originalFileName: image.originalFileName ?? null,
    contentType: image.contentType ?? null,
    sizeBytes:
      typeof image.sizeBytes === 'number' && Number.isFinite(image.sizeBytes)
        ? image.sizeBytes
        : null,
    createdAt,
    games: normalizedGames
  };
};

export async function loadStoredImages(): Promise<StoredImageSummary[]> {
  const response = await fetch('/api/stored-images');
  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Unable to load stored images');
  }

  const parsed = Array.isArray(data.images)
    ? ((data.images as StoredImagePayload[]) ?? [])
        .map((image) => normalizeStoredImage(image))
        .filter((image): image is StoredImageSummary => Boolean(image))
    : [];

  return parsed;
}

export async function saveStoredGameCorrection(
  storedImageId: string,
  gameIndex: number,
  game: Game
): Promise<StoredGameSummary> {
  const response = await fetch(`/api/stored-images/${storedImageId}/scores/${gameIndex}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      game
    })
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to save correction');
  }

  const normalized = normalizeStoredGame(
    {
      ...(data.game ?? {}),
      gameIndex,
      isEstimate: false
    } as StoredGamePayload,
    gameIndex
  );

  if (!normalized) {
    throw new Error('Received invalid correction data from server');
  }

  return normalized;
}
