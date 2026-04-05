'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { StoredImagesPanel } from './StoredImagesPanel';
import type { StoredImagePayload, StoredImageSummary, StoredImagesPage } from '@/types/stored-image';
import type { Game } from '@/types/bowling';
import {
  loadStoredImages,
  normalizeStoredImage,
  saveStoredGameCorrection
} from '@/utils/storedImages';

type StoredImagesLibraryProps = {
  initialImageId?: string | null;
  initialGameIndex?: number | null;
};

const LIBRARY_PAGE_SIZE = 50;

export function StoredImagesLibrary({ initialImageId, initialGameIndex }: StoredImagesLibraryProps) {
  const [images, setImages] = useState<StoredImageSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null);
  const [clearingImageId, setClearingImageId] = useState<string | null>(null);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalImages, setTotalImages] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [activeImageIndexOnPage, setActiveImageIndexOnPage] = useState(0);
  const pollAbortRef = useRef(false);
  const pendingPageTargetRef = useRef<'start' | 'end' | null>(null);

  useEffect(() => {
    pollAbortRef.current = false;
    return () => {
      pollAbortRef.current = true;
    };
  }, []);

  const applyPageData = useCallback((data: StoredImagesPage) => {
    setImages(data.images);
    setCurrentPage(data.page);
    setTotalImages(data.totalImages);
    setTotalPages(data.totalPages);
    if (pendingPageTargetRef.current === 'end') {
      setActiveImageIndexOnPage(Math.max(0, data.images.length - 1));
    } else {
      setActiveImageIndexOnPage(0);
    }
    pendingPageTargetRef.current = null;
  }, []);

  const fetchImages = useCallback(async (page: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const parsed = await loadStoredImages(page, LIBRARY_PAGE_SIZE);
      applyPageData(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your uploads');
    } finally {
      setIsLoading(false);
    }
  }, [applyPageData]);

  useEffect(() => {
    void fetchImages(currentPage);
  }, [currentPage, fetchImages]);

  const refreshImagesSilently = useCallback(async () => {
    try {
      const parsed = await loadStoredImages(currentPage, LIBRARY_PAGE_SIZE);
      if (!pollAbortRef.current) {
        applyPageData(parsed);
      }
      return parsed;
    } catch (err) {
      console.warn('Failed to refresh stored images', err);
      return null;
    }
  }, [applyPageData, currentPage]);

  const pollEstimateCompletion = useCallback(
    async (imageId: string) => {
      const maxAttempts = 30;
      const delayMs = 4000;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (pollAbortRef.current) {
          return;
        }

        await new Promise((resolve) => {
          setTimeout(resolve, delayMs);
        });

        if (pollAbortRef.current) {
          return;
        }

        const latest = await refreshImagesSilently();
        if (!latest) {
          continue;
        }

        const target = latest.images.find((image) => image.id === imageId);
        if (!target?.isProcessingEstimate) {
          return;
        }
      }
    },
    [refreshImagesSilently]
  );

  const handleGenerateScores = useCallback(
    async (imageId: string) => {
      setGeneratingImageId(imageId);
      try {
        const response = await fetch(`/api/stored-images/${imageId}/rescore`, {
          method: 'POST'
        });
        const data = await response.json();
        if (!response.ok || !data?.success) {
          throw new Error(
            typeof data?.error === 'string' ? data.error : 'Unable to generate score estimate'
          );
        }
        const normalized = normalizeStoredImage(data.storedImage as StoredImagePayload);
        if (normalized) {
          setImages((prev) => {
            const existingIndex = prev.findIndex((image) => image.id === normalized.id);
            if (existingIndex === -1) {
              return [normalized, ...prev];
            }
            const clone = [...prev];
            clone[existingIndex] = normalized;
            return clone;
          });
        }
        if (data?.queued) {
          void pollEstimateCompletion(imageId);
        }
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate score estimate');
      } finally {
        setGeneratingImageId(null);
      }
    },
    [pollEstimateCompletion]
  );

  const handleClearScores = useCallback(async (imageId: string) => {
    setClearingImageId(imageId);
    try {
      const response = await fetch(`/api/stored-images/${imageId}/scores`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(
          typeof data?.error === 'string' ? data.error : 'Unable to remove score estimate'
        );
      }
      setImages((prev) =>
        prev.map((image) => (image.id === imageId ? { ...image, games: [] } : image))
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove score estimate');
    } finally {
      setClearingImageId(null);
    }
  }, []);

  const handleDeleteImage = useCallback(async (imageId: string) => {
    setDeletingImageId(imageId);
    try {
      const response = await fetch(`/api/stored-images/${imageId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to delete image');
      }
      setImages((prev) => prev.filter((image) => image.id !== imageId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete image');
    } finally {
      setDeletingImageId(null);
    }
  }, []);

  const handleUpdateGame = useCallback(
    async (imageId: string, gameIndex: number, updatedGame: Game) => {
      try {
        const normalized = await saveStoredGameCorrection(imageId, gameIndex, updatedGame);
        setImages((prev) =>
          prev.map((image) => {
            if (image.id !== imageId) {
              return image;
            }
            const nextGames = image.games.some((game) => game.gameIndex === normalized.gameIndex)
              ? image.games.map((game) =>
                  game.gameIndex === normalized.gameIndex ? normalized : game
                )
              : [...image.games, normalized];
            return { ...image, games: nextGames };
          })
        );
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save correction';
        setError(message);
        throw err;
      }
    },
    []
  );

  return (
    <StoredImagesPanel
      images={images}
      isLoading={isLoading}
      error={error}
      onRetry={() => {
        void fetchImages(currentPage);
      }}
      onGenerateScores={handleGenerateScores}
      onClearScores={handleClearScores}
      onDeleteImage={handleDeleteImage}
      generatingImageId={generatingImageId}
      clearingImageId={clearingImageId}
      deletingImageId={deletingImageId}
      onUpdateGame={handleUpdateGame}
      initialImageId={initialImageId ?? null}
      initialGameIndex={initialGameIndex ?? null}
      totalImageCount={totalImages}
      imageIndexOffset={(currentPage - 1) * LIBRARY_PAGE_SIZE}
      pageSelectionKey={currentPage}
      initialActiveIndex={activeImageIndexOnPage}
      onRequestPreviousImagePage={
        currentPage > 1 && !isLoading
          ? () => {
              pendingPageTargetRef.current = 'end';
              setCurrentPage((page) => Math.max(1, page - 1));
            }
          : undefined
      }
      onRequestNextImagePage={
        currentPage < totalPages && !isLoading
          ? () => {
              pendingPageTargetRef.current = 'start';
              setCurrentPage((page) => Math.min(totalPages, page + 1));
            }
          : undefined
      }
    />
  );
}
