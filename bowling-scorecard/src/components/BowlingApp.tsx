'use client';
/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import { Scorecard } from './Scorecard';
import { FrameCorrectionModal } from './FrameCorrectionModal';
import { PlayerNameModal } from './PlayerNameModal';
import { Game } from '../types/bowling';
import { extractScoresFromImage } from '../utils/scoreExtractor';
import { initClientDiagnostics, logClientEvent } from '../utils/clientDiagnostics';

type ErrorDiagnostics = {
  endpoint?: string;
  status?: number;
  occurredAt: string;
};

const loadingContainerStyles: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const loadingTextStyles: CSSProperties = {
  fontSize: '20px'
};

const appContainerStyles: CSSProperties = {
  minHeight: '100vh',
  paddingTop: '32px',
  paddingBottom: '32px'
};

const buttonContainerStyles: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '16px',
  marginTop: '24px'
};

const buttonStyles: CSSProperties = {
  backgroundColor: '#2563eb',
  color: 'white',
  fontWeight: 'bold',
  padding: '12px 24px',
  borderRadius: '8px',
  border: 'none',
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  cursor: 'pointer',
  fontSize: '16px',
  transition: 'background-color 0.2s'
};

const uploadContainerStyles: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  marginTop: '24px'
};

const fileInputStyles: CSSProperties = {
  marginBottom: '16px'
};

const summaryBoxStyles: CSSProperties = {
  marginTop: '16px',
  padding: '12px 16px',
  borderRadius: '8px',
  backgroundColor: '#ecfdf5',
  border: '1px solid #6ee7b7',
  color: '#065f46',
  fontSize: '16px',
  fontWeight: 500
};

const warningBoxStyles: CSSProperties = {
  marginTop: '16px',
  padding: '12px 16px',
  borderRadius: '8px',
  backgroundColor: '#fff7ed',
  border: '1px solid #fdba74',
  color: '#9a3412'
};

const warningTitleStyles: CSSProperties = {
  fontSize: '16px',
  fontWeight: 'bold',
  marginBottom: '8px'
};

const warningListStyles: CSSProperties = {
  margin: 0,
  paddingLeft: '18px'
};

const imageWrapperStyles: CSSProperties = {
  position: 'relative',
  display: 'inline-block',
  marginTop: '16px',
  border: '2px solid #e5e7eb',
  borderRadius: '8px',
  overflow: 'hidden'
};

const imageStyles: CSSProperties = {
  maxWidth: '600px',
  maxHeight: '400px',
  display: 'block'
};

const contentLayoutStyles: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '24px',
  justifyContent: 'center',
  alignItems: 'flex-start',
  width: '100%',
  marginTop: '24px'
};

const scorecardContainerStyles: CSSProperties = {
  flex: '1 1 480px',
  minWidth: '320px',
  maxWidth: '640px'
};

const emptyStateStyles: CSSProperties = {
  marginTop: '56px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  gap: '12px',
  color: '#475569'
};

const emptyStateTitleStyles: CSSProperties = {
  fontSize: '24px',
  fontWeight: 700,
  color: '#0f172a'
};

const emptyStateTextStyles: CSSProperties = {
  fontSize: '16px',
  maxWidth: '480px',
  lineHeight: 1.5
};

const previewPlaceholderStyles: CSSProperties = {
  width: '100%',
  height: '100%',
  minHeight: '220px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: '16px',
  color: '#475569',
  backgroundColor: '#f8fafc',
  border: '1px dashed #cbd5f5',
  borderRadius: '12px'
};

function BowlingApp() {
  const [games, setGames] = useState<Game[]>([]);
  const [currentGameIndex, setCurrentGameIndex] = useState(0);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [editingFrameIndex, setEditingFrameIndex] = useState<number | null>(null);
  const [isRenamingPlayer, setIsRenamingPlayer] = useState(false);
  const [pendingPlayerName, setPendingPlayerName] = useState('');
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.innerWidth <= 640;
  });
  const [previewPlaceholder, setPreviewPlaceholder] = useState<string | null>(null);
  const [errorDiagnostics, setErrorDiagnostics] = useState<ErrorDiagnostics | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const reportExtractionFailure = useCallback(
    (
      message: string,
      details?: {
        endpoint?: string;
        status?: number;
        context?: Record<string, unknown>;
        stack?: string;
      }
    ) => {
      setExtractionError(message);
      setErrorDiagnostics({
        endpoint: details?.endpoint,
        status: details?.status,
        occurredAt: new Date().toISOString()
      });
      void logClientEvent({
        level: 'error',
        message,
        stack: details?.stack,
        context: {
          ...details?.context,
          endpoint: details?.endpoint,
          status: details?.status
        }
      });
    },
    []
  );

  const isHeicFile = (file: File) => {
    const mime = file.type?.toLowerCase() ?? '';
    const name = file.name?.toLowerCase() ?? '';
    return (
      mime === 'image/heic' ||
      mime === 'image/heif' ||
      mime === 'image/heic-sequence' ||
      mime === 'image/heif-sequence' ||
      name.endsWith('.heic') ||
      name.endsWith('.heif') ||
      name.endsWith('.heifs')
    );
  };

  const isHeicDataUrl = (dataUrl: string) => {
    const lowercase = dataUrl.slice(0, 40).toLowerCase();
    return lowercase.startsWith('data:image/heic') || lowercase.startsWith('data:image/heif');
  };

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === 'undefined') {
        return;
      }
      setIsMobile(window.innerWidth <= 640);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const teardown = initClientDiagnostics();
    return () => {
      teardown?.();
    };
  }, []);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = event.target;
    const file = inputEl.files?.[0];
    if (file) {
      const shouldDelayPreview = isHeicFile(file);
      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageData = e.target?.result as string;
        const treatAsHeic = shouldDelayPreview || isHeicDataUrl(imageData);
        if (treatAsHeic) {
          setPreviewPlaceholder('Preview will appear after we convert your HEIC photo...');
          setUploadedImage(null);
        } else {
          setUploadedImage(imageData);
          setPreviewPlaceholder(null);
        }
        setExtractionError(null);
        setErrorDiagnostics(null);
        setIsProcessing(true);
        
        try {
          const result = await extractScoresFromImage(imageData);
          
          if (result.success && result.games && result.games.length > 0) {
            setGames(result.games);
            setCurrentGameIndex(0);
            setErrorDiagnostics(null);
            if (result.normalizedImageDataUrl) {
              setUploadedImage(result.normalizedImageDataUrl);
              setPreviewPlaceholder(null);
            } else if (treatAsHeic) {
              setPreviewPlaceholder('Preview unavailable for this format, please review the extracted frames below.');
            }
          } else {
            const message = result.error || 'Failed to extract scores';
            reportExtractionFailure(message, {
              endpoint: result.endpoint,
              status: result.status,
              context: { source: 'handleImageUpload' }
            });
          }
        } catch (error) {
          const message = `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
          reportExtractionFailure(message, {
            context: { source: 'handleImageUpload' },
            stack: error instanceof Error ? error.stack : undefined
          });
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsDataURL(file);
      inputEl.value = '';
    }
  };

  const loadTestImage = useCallback(async () => {
    try {
      setIsProcessing(true);
      setExtractionError(null);
       setErrorDiagnostics(null);
      const response = await fetch('/test-scorecard.jpg');
      const blob = await response.blob();
      
      // Convert to base64 data URL for OpenAI API
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        
        setUploadedImage(dataUrl);
        setPreviewPlaceholder(null);
        setExtractionError(null);
        setErrorDiagnostics(null);
        
        try {
          // Process the image with OpenAI
          const result = await extractScoresFromImage(dataUrl);
          
          if (result.success && result.games && result.games.length > 0) {
            setGames(result.games);
            setCurrentGameIndex(0);
            if (result.normalizedImageDataUrl) {
              setUploadedImage(result.normalizedImageDataUrl);
              setPreviewPlaceholder(null);
            }
          } else {
            const message = result.error || 'Failed to extract scores from test image';
            reportExtractionFailure(message, {
              endpoint: result.endpoint,
              status: result.status,
              context: { source: 'loadTestImage' }
            });
            console.log('Raw OpenAI response:', result.rawText);
          }
        } catch (error) {
          const message = `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
          reportExtractionFailure(message, {
            context: { source: 'loadTestImage' },
            stack: error instanceof Error ? error.stack : undefined
          });
        } finally {
          setIsProcessing(false);
        }
      };
      
      reader.readAsDataURL(blob);
      
    } catch (error) {
      const message = `Failed to load test image: ${error instanceof Error ? error.message : 'Unknown error'}`;
      reportExtractionFailure(message, {
        context: { source: 'loadTestImage.fetch' },
        stack: error instanceof Error ? error.stack : undefined
      });
      setIsProcessing(false);
    }
  }, [reportExtractionFailure]);

  const shouldAutoLoadTestImage = process.env.NEXT_PUBLIC_ENABLE_AUTO_TEST_IMAGE === 'true';

  useEffect(() => {
    if (shouldAutoLoadTestImage) {
      loadTestImage();
    } else {
      setGames([]);
      setCurrentGameIndex(0);
      setUploadedImage(null);
      setExtractionError(null);
      setErrorDiagnostics(null);
      setIsProcessing(false);
    }
  }, [loadTestImage, shouldAutoLoadTestImage]);

  useEffect(() => {
    if (games.length === 0) {
      setCurrentGameIndex(0);
    } else if (currentGameIndex >= games.length) {
      setCurrentGameIndex(games.length - 1);
    }
  }, [games.length, currentGameIndex]);

  const activeGame = useMemo(() => {
    if (games.length === 0) {
      return null;
    }
    return games[Math.max(0, Math.min(currentGameIndex, games.length - 1))];
  }, [games, currentGameIndex]);

  const displayedGame = activeGame;

  const hasMultipleGames = games.length > 1;

  const averageConfidence = useMemo(() => {
    if (games.length === 0) {
      return null;
    }
    return (
      games.reduce((sum, g) => sum + (g.confidence ?? 0), 0) / games.length
    );
  }, [games]);

  const reviewGames = useMemo(
    () =>
      games.filter(
        (g) => (g.issues?.length ?? 0) > 0 || (g.confidence ?? 1) < 0.8
      ),
    [games]
  );

  const responsiveButtonContainerStyles = useMemo<CSSProperties>(
    () => ({
      ...buttonContainerStyles,
      flexDirection: isMobile ? ('column' as const) : ('row' as const),
      alignItems: isMobile ? ('stretch' as const) : ('center' as const),
      gap: isMobile ? '12px' : buttonContainerStyles.gap
    }),
    [isMobile]
  );

  const responsiveLayoutStyles = useMemo<CSSProperties>(
    () => ({
      ...contentLayoutStyles,
      flexDirection: isMobile ? ('column' as const) : ('row' as const),
      gap: isMobile ? '16px' : contentLayoutStyles.gap
    }),
    [isMobile]
  );

  const responsiveScorecardStyles = useMemo(
    () => ({
      ...scorecardContainerStyles,
      flex: isMobile ? '1 1 100%' : scorecardContainerStyles.flex,
      minWidth: isMobile ? '100%' : scorecardContainerStyles.minWidth,
      maxWidth: isMobile ? '100%' : scorecardContainerStyles.maxWidth,
      maxHeight: isMobile ? '52vh' : undefined,
      overflowY: isMobile ? ('auto' as const) : ('visible' as const),
      overflowX: isMobile ? ('auto' as const) : ('visible' as const),
      WebkitOverflowScrolling: isMobile ? ('touch' as const) : undefined
    }),
    [isMobile]
  );

  const responsiveImageWrapperStyles = useMemo(
    () => ({
      ...imageWrapperStyles,
      width: isMobile ? '100%' : undefined,
      maxHeight: isMobile ? '35vh' : undefined,
      overflow: 'hidden'
    }),
    [isMobile]
  );

  const responsiveImageStyles = useMemo(
    () =>
      isMobile
        ? {
            ...imageStyles,
            width: '100%',
            height: '100%',
            maxHeight: '35vh',
            objectFit: 'contain' as const
          }
        : imageStyles,
    [isMobile]
  );

  const responsiveFileInputStyles = useMemo(
    () => ({
      ...fileInputStyles,
      width: isMobile ? '100%' : undefined
    }),
    [isMobile]
  );

  const handleFrameSelect = (frameIndex: number) => {
    if (!activeGame || isProcessing || isRenamingPlayer) {
      return;
    }
    setEditingFrameIndex(frameIndex);
  };

  const handleCloseFrameModal = () => {
    setEditingFrameIndex(null);
  };

  const handleApplyFrameCorrection = (updatedGame: Game) => {
    setGames((prev) =>
      prev.map((g, idx) => (idx === currentGameIndex ? updatedGame : g))
    );
    setEditingFrameIndex(null);
  };

  const handlePlayerNameClick = () => {
    if (!activeGame || isProcessing || editingFrameIndex !== null) {
      return;
    }
    setPendingPlayerName(activeGame.playerName);
    setIsRenamingPlayer(true);
  };

  const handleApplyPlayerName = (name: string) => {
    setGames((prev) =>
      prev.map((g, idx) => (idx === currentGameIndex ? { ...g, playerName: name } : g))
    );
    setIsRenamingPlayer(false);
    setPendingPlayerName('');
  };

  const controlsLocked = isProcessing || editingFrameIndex !== null || isRenamingPlayer;

  const paginationControls = (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '8px',
        marginTop: '16px',
        flexWrap: 'wrap'
      }}
    >
      <button
        type="button"
        onClick={() => {
          if (controlsLocked) {
            return;
          }
          setCurrentGameIndex((prev) => Math.max(prev - 1, 0));
        }}
        disabled={currentGameIndex === 0 || controlsLocked}
        style={{
          padding: '8px 12px',
          borderRadius: '6px',
          border: '1px solid #d1d5db',
          backgroundColor:
            currentGameIndex === 0 || controlsLocked ? '#e5e7eb' : '#2563eb',
          color: currentGameIndex === 0 || controlsLocked ? '#6b7280' : '#ffffff',
          cursor: currentGameIndex === 0 || controlsLocked ? 'not-allowed' : 'pointer',
          fontWeight: 600
        }}
      >
        Previous
      </button>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {games.map((g, index) => {
          const isActive = index === currentGameIndex;
          return (
            <button
              type="button"
              key={`${g.playerName}-${index}`}
              onClick={() => {
                if (controlsLocked) {
                  return;
                }
                setCurrentGameIndex(index);
              }}
              disabled={controlsLocked}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: isActive ? '2px solid #2563eb' : '1px solid #d1d5db',
                backgroundColor: isActive ? '#dbeafe' : '#ffffff',
                color: '#1f2937',
                fontWeight: isActive ? 700 : 500,
                cursor: controlsLocked ? 'not-allowed' : 'pointer',
                opacity: controlsLocked ? 0.6 : 1
              }}
            >
              {g.playerName || `Player ${index + 1}`}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => {
          if (controlsLocked) {
            return;
          }
          setCurrentGameIndex((prev) => Math.min(prev + 1, games.length - 1));
        }}
        disabled={currentGameIndex >= games.length - 1 || controlsLocked}
        style={{
          padding: '8px 12px',
          borderRadius: '6px',
          border: '1px solid #d1d5db',
          backgroundColor:
            currentGameIndex >= games.length - 1 || controlsLocked ? '#e5e7eb' : '#2563eb',
          color:
            currentGameIndex >= games.length - 1 || controlsLocked ? '#6b7280' : '#ffffff',
          cursor:
            currentGameIndex >= games.length - 1 || controlsLocked ? 'not-allowed' : 'pointer',
          fontWeight: 600
        }}
      >
        Next
      </button>
    </div>
  );

  const showInitialLoader =
    shouldAutoLoadTestImage && isProcessing && !uploadedImage && !extractionError;

  if (showInitialLoader) {
    return (
      <div style={loadingContainerStyles}>
        <div style={loadingTextStyles}>Loading test image...</div>
      </div>
    );
  }

  return (
    <div style={appContainerStyles}>
      <div style={responsiveButtonContainerStyles}>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          style={responsiveFileInputStyles}
          disabled={controlsLocked}
        />
        <button
          type="button"
          style={{
            ...buttonStyles,
            width: isMobile ? '100%' : 'auto',
            opacity: controlsLocked ? 0.6 : 1,
            cursor: controlsLocked ? 'not-allowed' : 'pointer',
            backgroundColor: '#0f172a'
          }}
          onClick={() => {
            if (controlsLocked) {
              return;
            }
            cameraInputRef.current?.click();
          }}
          disabled={controlsLocked}
        >
          Capture Photo
        </button>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleImageUpload}
        />
        <button
          type="button"
          style={{
            ...buttonStyles,
            width: isMobile ? '100%' : 'auto',
            opacity: controlsLocked ? 0.6 : 1,
            cursor: controlsLocked ? 'not-allowed' : 'pointer'
          }}
          onClick={() => {
            if (controlsLocked) {
              return;
            }
            loadTestImage();
          }}
          disabled={controlsLocked}
        >
          Use Sample Image
        </button>
      </div>

      {displayedGame ? (
        <div style={uploadContainerStyles}>
          <div style={responsiveLayoutStyles}>
            <div style={responsiveImageWrapperStyles}>
              {uploadedImage ? (
                <img src={uploadedImage} alt="Uploaded scorecard" style={responsiveImageStyles} />
              ) : (
                <div style={previewPlaceholderStyles}>
                  {previewPlaceholder ?? 'Upload an image to see a preview once processing finishes.'}
                </div>
              )}
            </div>
            <div style={responsiveScorecardStyles}>
              <Scorecard
                game={displayedGame}
                onFrameSelect={handleFrameSelect}
                onPlayerNameClick={handlePlayerNameClick}
                disableEditing={controlsLocked}
                compact={isMobile}
              />
            </div>
          </div>
          {hasMultipleGames && paginationControls}
        </div>
      ) : (
        <div style={emptyStateStyles}>
          <h3 style={emptyStateTitleStyles}>Upload a bowling scorecard</h3>
          <p style={emptyStateTextStyles}>
            Choose a photo or screenshot of a bowling score sheet. We’ll extract every frame, let you
            correct mistakes, and keep the image side-by-side for reference.
          </p>
        </div>
      )}

      {editingFrameIndex !== null && activeGame && (
        <FrameCorrectionModal
          game={activeGame}
          frameIndex={editingFrameIndex}
          onApply={handleApplyFrameCorrection}
          onClose={handleCloseFrameModal}
        />
      )}

      {isRenamingPlayer && activeGame && (
        <PlayerNameModal
          initialName={pendingPlayerName || activeGame.playerName}
          onSave={handleApplyPlayerName}
          onCancel={() => {
            setIsRenamingPlayer(false);
            setPendingPlayerName('');
          }}
        />
      )}

      {!isProcessing && averageConfidence !== null && (
        <div style={summaryBoxStyles}>
          Extracted {games.length} player{games.length > 1 ? 's' : ''}.{' '}
          Average confidence {Math.round(averageConfidence * 100)}%.
        </div>
      )}

      {!isProcessing && reviewGames.length > 0 && (
        <div style={warningBoxStyles}>
          <div style={warningTitleStyles}>Please review before accepting:</div>
          <ul style={warningListStyles}>
            {reviewGames.map((g) => (
              <li key={`review-${g.playerName}`}>
                {g.playerName} — confidence {Math.round((g.confidence ?? 0) * 100)}%
                {g.issues && g.issues.length > 0 ? ` (${g.issues[0]})` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isProcessing && (
        <p style={{ marginTop: '16px', fontSize: '16px', color: '#2563eb', textAlign: 'center' }}>
          Processing image with OCR... This may take a moment.
        </p>
      )}

      {extractionError && (
        <div
          style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#b91c1c',
            maxWidth: '640px',
            marginLeft: 'auto',
            marginRight: 'auto'
          }}
        >
          <p style={{ fontSize: '16px', fontWeight: 'bold' }}>Error:</p>
          <p style={{ fontSize: '14px' }}>{extractionError}</p>
          {errorDiagnostics && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#7f1d1d' }}>
              {errorDiagnostics.endpoint && (
                <p style={{ margin: 0 }}>
                  Endpoint:{' '}
                  <code style={{ fontSize: '11px' }}>{errorDiagnostics.endpoint}</code>
                </p>
              )}
              {typeof errorDiagnostics.status === 'number' && (
                <p style={{ margin: 0 }}>Status code: {errorDiagnostics.status}</p>
              )}
              <p style={{ margin: 0 }}>
                Recorded at:{' '}
                {new Date(errorDiagnostics.occurredAt).toLocaleString(undefined, {
                  hour12: false
                })}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default BowlingApp;
