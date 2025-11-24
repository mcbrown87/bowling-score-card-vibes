'use client';

import { useCallback, useEffect, useState } from 'react';
import { StoredImagesPanel } from './StoredImagesPanel';
import type { StoredImagePayload, StoredImageSummary } from '@/types/stored-image';
import { loadStoredImages, normalizeStoredImage } from '@/utils/storedImages';

export function StoredImagesLibrary() {
  const [images, setImages] = useState<StoredImageSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null);
  const [clearingImageId, setClearingImageId] = useState<string | null>(null);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);

  const fetchImages = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const parsed = await loadStoredImages();
      setImages(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your uploads');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchImages();
  }, [fetchImages]);

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
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate score estimate');
      } finally {
        setGeneratingImageId(null);
      }
    },
    []
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

  return (
    <StoredImagesPanel
      images={images}
      isLoading={isLoading}
      error={error}
      onRetry={() => {
        void fetchImages();
      }}
      onGenerateScores={handleGenerateScores}
      onClearScores={handleClearScores}
      onDeleteImage={handleDeleteImage}
      generatingImageId={generatingImageId}
      clearingImageId={clearingImageId}
      deletingImageId={deletingImageId}
    />
  );
}
