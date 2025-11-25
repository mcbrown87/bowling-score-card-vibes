/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { StoredImageSummary } from '@/types/stored-image';
import type { Game } from '@/types/bowling';
import { Scorecard } from './Scorecard';
import { FrameCorrectionModal } from './FrameCorrectionModal';

interface StoredImagesPanelProps {
  images: StoredImageSummary[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onGenerateScores?: (imageId: string) => void;
  onClearScores?: (imageId: string) => void;
  onDeleteImage?: (imageId: string) => void;
  generatingImageId?: string | null;
  clearingImageId?: string | null;
  deletingImageId?: string | null;
  onUpdateGame?: (imageId: string, gameIndex: number, updatedGame: Game) => Promise<void> | void;
}

const sectionStyles: CSSProperties = {
  width: '100%',
  marginTop: '48px'
};

const cardStyles: CSSProperties = {
  padding: '24px',
  borderRadius: '16px',
  backgroundColor: '#ffffff',
  boxShadow: '0 4px 20px rgba(15, 23, 42, 0.08)'
};

const headerStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '12px',
  flexWrap: 'wrap'
};

const titleStyles: CSSProperties = {
  fontSize: '24px',
  fontWeight: 700,
  margin: 0,
  color: '#0f172a'
};

const subtitleStyles: CSSProperties = {
  margin: 0,
  color: '#475569',
  fontSize: '14px'
};

const thumbWrapperStyles: CSSProperties = {
  width: '100%',
  maxWidth: '560px',
  margin: '0 auto',
  position: 'relative',
  backgroundColor: '#e2e8f0',
  borderRadius: '12px',
  overflow: 'hidden',
  minHeight: '320px'
};

const thumbImageStyles: CSSProperties = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover' as const
};

const metaStyles: CSSProperties = {
  fontSize: '13px',
  color: '#475569',
  lineHeight: 1.4
};

const carouselControlsStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: '16px',
  gap: '16px',
  flexWrap: 'wrap'
};

const navButtonStyles: CSSProperties = {
  padding: '10px 16px',
  borderRadius: '999px',
  border: '1px solid #cbd5f5',
  backgroundColor: '#fff',
  cursor: 'pointer',
  minWidth: '88px'
};

const navButtonDisabledStyles: CSSProperties = {
  ...navButtonStyles,
  opacity: 0.5,
  cursor: 'not-allowed'
};

const indicatorStyles: CSSProperties = {
  flex: '1 1 auto',
  textAlign: 'center' as const,
  fontSize: '14px',
  color: '#475569'
};

const errorBoxStyles: CSSProperties = {
  marginTop: '16px',
  padding: '12px 16px',
  borderRadius: '8px',
  backgroundColor: '#fef2f2',
  border: '1px solid #fecaca',
  color: '#b91c1c',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px'
};

const buttonStyles: CSSProperties = {
  padding: '6px 12px',
  borderRadius: '6px',
  border: 'none',
  backgroundColor: '#2563eb',
  color: '#fff',
  cursor: 'pointer'
};

const primaryActionButtonStyles: CSSProperties = {
  padding: '10px 16px',
  borderRadius: '8px',
  border: 'none',
  backgroundColor: '#2563eb',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 600,
  minWidth: '180px'
};

const primaryActionButtonDisabledStyles: CSSProperties = {
  ...primaryActionButtonStyles,
  opacity: 0.5,
  cursor: 'not-allowed'
};

const emptyStateStyles: CSSProperties = {
  marginTop: '24px',
  padding: '32px',
  textAlign: 'center' as const,
  borderRadius: '12px',
  border: '1px dashed #cbd5f5',
  color: '#475569'
};

const loadingTextStyles: CSSProperties = {
  marginTop: '24px',
  textAlign: 'center' as const,
  color: '#2563eb'
};

const scorecardSectionStyles: CSSProperties = {
  marginTop: '32px',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  backgroundColor: '#f8fafc',
  padding: '16px',
  overflowX: 'hidden'
};

const scorecardWrapperStyles: CSSProperties = {
  width: '100%',
  overflowX: 'auto',
  padding: '0 4px'
};

const scorecardInnerStyles: CSSProperties = {
  maxWidth: '960px',
  margin: '0 auto'
};

const noScoresStyles: CSSProperties = {
  marginTop: '24px',
  padding: '16px',
  borderRadius: '8px',
  border: '1px dashed #fdba74',
  backgroundColor: '#fff7ed',
  color: '#9a3412',
  textAlign: 'center' as const
};

const gameControlsStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '12px',
  marginTop: '16px',
  flexWrap: 'wrap'
};

const formatFileSize = (size: number | null) => {
  if (!size || size <= 0) {
    return null;
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (isoDate: string) => {
  try {
    return new Date(isoDate).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return isoDate;
  }
};

export function StoredImagesPanel({
  images,
  isLoading,
  error,
  onRetry,
  onGenerateScores,
  onClearScores,
  onDeleteImage,
  generatingImageId,
  clearingImageId,
  deletingImageId,
  onUpdateGame
}: StoredImagesPanelProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeGameIndex, setActiveGameIndex] = useState(0);
  const [editingFrameIndex, setEditingFrameIndex] = useState<number | null>(null);
  const [isSavingCorrection, setIsSavingCorrection] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const hasImages = images.length > 0;

  const boundedImageIndex = useMemo(
    () => (hasImages ? Math.min(activeIndex, images.length - 1) : 0),
    [activeIndex, hasImages, images.length]
  );

  const activeImage = hasImages ? images[boundedImageIndex] : null;
  const activeImageFileSize = activeImage ? formatFileSize(activeImage.sizeBytes) : null;
  const gamesForImage = activeImage?.games ?? [];
  const hasScoreEstimates = gamesForImage.length > 0;
  const boundedGameIndex = hasScoreEstimates
    ? Math.min(activeGameIndex, gamesForImage.length - 1)
    : 0;
  const activeGame = hasScoreEstimates ? gamesForImage[boundedGameIndex] : null;

  useEffect(() => {
    setActiveIndex(0);
  }, [images.length]);

  useEffect(() => {
    setActiveGameIndex(0);
  }, [activeImage?.id]);

  useEffect(() => {
    setEditingFrameIndex(null);
    setCorrectionError(null);
  }, [activeImage?.id, boundedGameIndex]);

  const isGeneratingActiveImage =
    typeof generatingImageId === 'string' && activeImage?.id === generatingImageId;
  const isClearingActiveImage =
    typeof clearingImageId === 'string' && activeImage?.id === clearingImageId;
  const isDeletingActiveImage =
    typeof deletingImageId === 'string' && activeImage?.id === deletingImageId;

  const canGoPrev = boundedImageIndex > 0;
  const canGoNext = boundedImageIndex < images.length - 1;
  const canGoPrevGame = boundedGameIndex > 0;
  const canGoNextGame = hasScoreEstimates && boundedGameIndex < gamesForImage.length - 1;
  const canEditScores =
    Boolean(onUpdateGame) &&
    hasScoreEstimates &&
    !isGeneratingActiveImage &&
    !isClearingActiveImage &&
    !isDeletingActiveImage &&
    !isSavingCorrection;

  const handleFrameSelect = useCallback(
    (frameIndex: number) => {
      if (!canEditScores) {
        return;
      }
      setEditingFrameIndex(frameIndex);
    },
    [canEditScores]
  );

  const handleCloseFrameModal = useCallback(() => {
    if (isSavingCorrection) {
      return;
    }
    setEditingFrameIndex(null);
    setCorrectionError(null);
  }, [isSavingCorrection]);

  const handleApplyFrameCorrection = useCallback(
    async (updatedGame: Game) => {
      if (!onUpdateGame || !activeImage || !activeGame) {
        return;
      }
      setCorrectionError(null);
      try {
        setIsSavingCorrection(true);
        await onUpdateGame(activeImage.id, activeGame.gameIndex, updatedGame);
        setEditingFrameIndex(null);
      } catch (error) {
        setCorrectionError(
          error instanceof Error ? error.message : 'Failed to save your correction'
        );
      } finally {
        setIsSavingCorrection(false);
      }
    },
    [activeGame, activeImage, onUpdateGame]
  );

  return (
    <section style={sectionStyles} aria-live="polite">
      <div style={cardStyles}>
        <header style={headerStyles}>
          <div>
            <h2 style={titleStyles}>Your Uploaded Images</h2>
            <p style={subtitleStyles}>Review every scorecard you have processed through the portal.</p>
          </div>
        </header>

        {error && (
          <div style={errorBoxStyles}>
            <span>{error}</span>
            <button type="button" style={buttonStyles} onClick={onRetry}>
              Try again
            </button>
          </div>
        )}

        {isLoading && !hasImages && <div style={loadingTextStyles}>Loading your uploads…</div>}

        {!isLoading && !hasImages && !error && (
          <div style={emptyStateStyles}>
            <strong>No uploads yet.</strong>
            <p style={{ margin: '8px 0 0' }}>Your processed images will appear here after you upload them.</p>
          </div>
        )}

        {hasImages && activeImage && (
          <>
            <div style={thumbWrapperStyles}>
              <img
                src={activeImage.previewUrl}
                alt={
                  activeImage.originalFileName
                    ? `Uploaded scorecard ${activeImage.originalFileName}`
                    : 'Uploaded scorecard preview'
                }
                style={thumbImageStyles}
                loading="lazy"
              />
            </div>
            <div style={{ ...metaStyles, marginTop: '16px', textAlign: 'center' as const }}>
              <div style={{ fontWeight: 600 }}>
                {activeImage.originalFileName ?? 'Untitled image'}
              </div>
              <div>Uploaded {formatDate(activeImage.createdAt)}</div>
              {activeImageFileSize && <div>{activeImageFileSize}</div>}
              {activeImage.contentType && <div>{activeImage.contentType}</div>}
            </div>
            {onDeleteImage && (
              <div style={{ marginTop: '12px', textAlign: 'center' as const }}>
                <button
                  type="button"
                  style={
                    isDeletingActiveImage || isSavingCorrection
                      ? primaryActionButtonDisabledStyles
                      : primaryActionButtonStyles
                  }
                  disabled={isDeletingActiveImage || isSavingCorrection}
                  onClick={() => {
                    if (!isDeletingActiveImage && !isSavingCorrection) {
                      onDeleteImage(activeImage.id);
                    }
                  }}
                >
                  {isDeletingActiveImage ? 'Deleting…' : 'Delete image'}
                </button>
              </div>
            )}
            {images.length > 1 && (
              <div style={carouselControlsStyles}>
                <button
                  type="button"
                  style={canGoPrev ? navButtonStyles : navButtonDisabledStyles}
                  onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
                  disabled={!canGoPrev}
                >
                  ← Previous
                </button>
                <div style={indicatorStyles}>
                  Image {boundedImageIndex + 1} of {images.length}
                </div>
                <button
                  type="button"
                  style={canGoNext ? navButtonStyles : navButtonDisabledStyles}
                  onClick={() => setActiveIndex((index) => Math.min(images.length - 1, index + 1))}
                  disabled={!canGoNext}
                >
                  Next →
                </button>
              </div>
            )}
            {hasScoreEstimates && activeGame ? (
              <div style={scorecardSectionStyles}>
                <div style={scorecardWrapperStyles}>
                  <div style={scorecardInnerStyles}>
                    <Scorecard
                      key={`${activeImage.id}-${boundedGameIndex}`}
                      game={activeGame}
                      onFrameSelect={handleFrameSelect}
                      disableEditing={!canEditScores || editingFrameIndex !== null}
                      compact
                    />
                  </div>
                </div>
                <div style={{ ...metaStyles, marginTop: '8px', textAlign: 'center' as const }}>
                  {activeGame.isEstimate ? 'Showing AI estimate' : 'Showing your corrections'}
                </div>
                {gamesForImage.length > 1 && (
                  <div style={gameControlsStyles}>
                    <button
                      type="button"
                      style={canGoPrevGame ? navButtonStyles : navButtonDisabledStyles}
                      onClick={() => setActiveGameIndex((index) => Math.max(0, index - 1))}
                      disabled={!canGoPrevGame}
                    >
                      ← Previous game
                    </button>
                    <div style={indicatorStyles}>
                      Game {boundedGameIndex + 1} of {gamesForImage.length}
                    </div>
                    <button
                      type="button"
                      style={canGoNextGame ? navButtonStyles : navButtonDisabledStyles}
                      onClick={() =>
                        setActiveGameIndex((index) => Math.min(gamesForImage.length - 1, index + 1))
                      }
                      disabled={!canGoNextGame}
                    >
                      Next game →
                    </button>
                  </div>
                )}
                {onClearScores && (
                  <div style={{ marginTop: '12px', textAlign: 'right' }}>
                    <button
                      type="button"
                      style={
                        isClearingActiveImage
                          ? primaryActionButtonDisabledStyles
                          : primaryActionButtonStyles
                      }
                      disabled={isClearingActiveImage || isSavingCorrection}
                      onClick={() => {
                        if (!isClearingActiveImage && !isSavingCorrection) {
                          onClearScores(activeImage.id);
                        }
                      }}
                    >
                      {isClearingActiveImage ? 'Clearing…' : 'Remove score estimate'}
                    </button>
                  </div>
                )}
                {correctionError && (
                  <div style={{ ...errorBoxStyles, marginTop: '12px' }}>
                    <span>{correctionError}</span>
                    <button
                      type="button"
                      style={{ ...buttonStyles, padding: '6px 10px' }}
                      onClick={() => setCorrectionError(null)}
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={noScoresStyles}>
                <p style={{ margin: '0 0 12px' }}>
                  No score estimate yet. Submit this image to generate scores.
                </p>
                {onGenerateScores && (
                  <button
                    type="button"
                    style={
                      isGeneratingActiveImage
                        ? primaryActionButtonDisabledStyles
                        : primaryActionButtonStyles
                    }
                    disabled={isGeneratingActiveImage || isSavingCorrection}
                    onClick={() => {
                      if (!isGeneratingActiveImage && !isSavingCorrection) {
                        onGenerateScores(activeImage.id);
                      }
                    }}
                  >
                    {isGeneratingActiveImage ? 'Submitting…' : 'Generate score estimate'}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {editingFrameIndex !== null && activeGame && canEditScores && (
        <FrameCorrectionModal
          game={activeGame}
          frameIndex={editingFrameIndex}
          onApply={handleApplyFrameCorrection}
          onClose={handleCloseFrameModal}
          isSaving={isSavingCorrection}
        />
      )}
    </section>
  );
}
