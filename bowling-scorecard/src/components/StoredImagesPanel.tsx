/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  marginTop: '16px'
};

const cardStyles: CSSProperties = {
  padding: '12px 12px 24px',
  borderRadius: '16px',
  backgroundColor: '#ffffff',
  boxShadow: '0 2px 12px rgba(15, 23, 42, 0.05)'
};

const thumbWrapperStyles: CSSProperties = {
  width: '100%',
  maxWidth: '100%',
  margin: '0 auto',
  position: 'relative',
  backgroundColor: '#e2e8f0',
  borderRadius: '12px',
  overflow: 'hidden',
  minHeight: '240px'
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
  fontSize: '12px',
  color: '#475569',
  lineHeight: 1.4
};

const metaHintStyles: CSSProperties = {
  marginTop: '6px',
  fontSize: '10px',
  color: '#94a3b8',
  textAlign: 'center' as const
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

const gameNavButtonStyles: CSSProperties = {
  width: '44px',
  height: '44px',
  borderRadius: '999px',
  border: '1px solid #cbd5f5',
  backgroundColor: '#fff',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '20px',
  color: '#0f172a'
};

const gameNavButtonDisabledStyles: CSSProperties = {
  ...gameNavButtonStyles,
  opacity: 0.4,
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
  marginTop: '16px',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  backgroundColor: '#f8fafc',
  padding: '12px',
  overflowX: 'hidden'
};

const scorecardWrapperStyles: CSSProperties = {
  width: '100%',
  overflowX: 'auto',
  padding: '0 2px'
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
  display: 'grid',
  gridTemplateColumns: 'auto 1fr auto',
  alignItems: 'center',
  gap: '16px',
  marginTop: '16px'
};

const closeButtonStyles: CSSProperties = {
  padding: '8px 14px',
  borderRadius: '8px',
  border: '1px solid #cbd5f5',
  backgroundColor: '#f8fafc',
  color: '#0f172a',
  cursor: 'pointer'
};

const modalOverlayStyles: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(15,23,42,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100
};

const modalCardStyles: CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: '16px',
  padding: '24px',
  width: '90%',
  maxWidth: '420px',
  boxShadow: '0 20px 40px rgba(15, 23, 42, 0.25)'
};

const modalTitleStyles: CSSProperties = {
  marginTop: 0,
  marginBottom: '12px',
  fontSize: '18px',
  fontWeight: 700,
  color: '#0f172a'
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
  const [metaModalOpen, setMetaModalOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scorecardPressTimerRef = useRef<NodeJS.Timeout | null>(null);
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

  useEffect(() => {
    setMetaModalOpen(false);
    setClearConfirmOpen(false);
  }, [activeImage?.id]);

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
  const canLongPressClear =
    Boolean(onClearScores) &&
    hasScoreEstimates &&
    !isGeneratingActiveImage &&
    !isClearingActiveImage &&
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

  const handlePressStart = useCallback(() => {
    if (!activeImage) {
      return;
    }
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
    }
    pressTimerRef.current = setTimeout(() => {
      setMetaModalOpen(true);
    }, 600);
  }, [activeImage]);

  const handlePressEnd = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }, []);

  const handleScorecardPressStart = useCallback(() => {
    if (!canLongPressClear || !activeImage || isClearingActiveImage || clearConfirmOpen) {
      return;
    }
    if (scorecardPressTimerRef.current) {
      clearTimeout(scorecardPressTimerRef.current);
    }
    scorecardPressTimerRef.current = setTimeout(() => {
      setClearConfirmOpen(true);
      scorecardPressTimerRef.current = null;
    }, 800);
  }, [activeImage, canLongPressClear, clearConfirmOpen, isClearingActiveImage]);

  const handleScorecardPressEnd = useCallback(() => {
    if (scorecardPressTimerRef.current) {
      clearTimeout(scorecardPressTimerRef.current);
      scorecardPressTimerRef.current = null;
    }
  }, []);

  const handleConfirmClear = useCallback(() => {
    if (!onClearScores || !activeImage || isClearingActiveImage) {
      return;
    }
    onClearScores(activeImage.id);
    setClearConfirmOpen(false);
  }, [activeImage, isClearingActiveImage, onClearScores]);

  const handleCancelClear = useCallback(() => {
    if (isClearingActiveImage) {
      return;
    }
    setClearConfirmOpen(false);
  }, [isClearingActiveImage]);

  useEffect(() => {
    return () => {
      if (pressTimerRef.current) {
        clearTimeout(pressTimerRef.current);
      }
      if (scorecardPressTimerRef.current) {
        clearTimeout(scorecardPressTimerRef.current);
      }
    };
  }, []);

  return (
    <section style={sectionStyles} aria-live="polite">
      <div style={cardStyles}>
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
            <div
              style={thumbWrapperStyles}
              onMouseDown={handlePressStart}
              onMouseUp={handlePressEnd}
              onMouseLeave={handlePressEnd}
              onTouchStart={handlePressStart}
              onTouchEnd={handlePressEnd}
              onTouchCancel={handlePressEnd}
            >
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
            <div style={{ ...metaHintStyles, marginTop: '8px' }}>
              Press and hold image for details
            </div>
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
                  <div
                    style={scorecardInnerStyles}
                    onMouseDown={handleScorecardPressStart}
                    onMouseUp={handleScorecardPressEnd}
                    onMouseLeave={handleScorecardPressEnd}
                    onTouchStart={handleScorecardPressStart}
                    onTouchEnd={handleScorecardPressEnd}
                    onTouchCancel={handleScorecardPressEnd}
                  >
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
                      style={canGoPrevGame ? gameNavButtonStyles : gameNavButtonDisabledStyles}
                      onClick={() => setActiveGameIndex((index) => Math.max(0, index - 1))}
                      disabled={!canGoPrevGame}
                      aria-label="Show previous game"
                    >
                      ←
                    </button>
                    <div style={indicatorStyles}>
                      Game {boundedGameIndex + 1} of {gamesForImage.length}
                    </div>
                    <button
                      type="button"
                      style={canGoNextGame ? gameNavButtonStyles : gameNavButtonDisabledStyles}
                      onClick={() =>
                        setActiveGameIndex((index) => Math.min(gamesForImage.length - 1, index + 1))
                      }
                      disabled={!canGoNextGame}
                      aria-label="Show next game"
                    >
                      →
                    </button>
                  </div>
                )}
                {canLongPressClear && (
                  <div
                    style={{
                      ...metaHintStyles,
                      marginTop: '12px',
                      textAlign: 'center' as const
                    }}
                  >
                    {isClearingActiveImage
                      ? 'Removing score estimate…'
                      : 'Long press any frame to remove this estimate (confirmation required)'}
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

      {metaModalOpen && activeImage && (
        <div style={modalOverlayStyles} role="dialog" aria-modal="true">
          <div style={modalCardStyles}>
            <h3 style={modalTitleStyles}>
              {activeImage.originalFileName ?? 'Image details'}
            </h3>
            <div style={{ ...metaStyles, marginBottom: '16px' }}>
              <div>Uploaded {formatDate(activeImage.createdAt)}</div>
              {activeImageFileSize && <div>{activeImageFileSize}</div>}
              {activeImage.contentType && <div>{activeImage.contentType}</div>}
            </div>
            {onDeleteImage && (
              <div style={{ marginBottom: '12px' }}>
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
                      setMetaModalOpen(false);
                    }
                  }}
                >
                  {isDeletingActiveImage ? 'Deleting…' : 'Delete image'}
                </button>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" style={closeButtonStyles} onClick={() => setMetaModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {clearConfirmOpen && activeImage && (
        <div style={modalOverlayStyles} role="dialog" aria-modal="true">
          <div style={modalCardStyles}>
            <h3 style={modalTitleStyles}>Remove score estimate?</h3>
            <p style={{ ...metaStyles, marginBottom: '16px' }}>
              This deletes the current AI estimate for this scorecard. You can rescan the image
              whenever you need a new estimate.
            </p>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                flexWrap: 'wrap'
              }}
            >
              <button
                type="button"
                style={closeButtonStyles}
                onClick={handleCancelClear}
                disabled={isClearingActiveImage}
              >
                Keep estimate
              </button>
              <button
                type="button"
                style={
                  isClearingActiveImage
                    ? primaryActionButtonDisabledStyles
                    : primaryActionButtonStyles
                }
                onClick={handleConfirmClear}
                disabled={isClearingActiveImage}
              >
                {isClearingActiveImage ? 'Removing…' : 'Remove estimate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
