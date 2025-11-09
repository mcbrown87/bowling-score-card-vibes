import { useState, useEffect, useCallback, useMemo } from 'react';
import { Scorecard } from './components/Scorecard';
import { FrameCorrectionModal } from './components/FrameCorrectionModal';
import { PlayerNameModal } from './components/PlayerNameModal';
import { Game } from './types/bowling';
import { extractScoresFromImage } from './utils/scoreExtractor';

const loadingContainerStyles: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const loadingTextStyles: React.CSSProperties = {
  fontSize: '20px'
};

const appContainerStyles: React.CSSProperties = {
  minHeight: '100vh',
  paddingTop: '32px',
  paddingBottom: '32px'
};

const buttonContainerStyles: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '16px',
  marginTop: '24px'
};

const buttonStyles: React.CSSProperties = {
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

const uploadContainerStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  marginTop: '24px'
};

const fileInputStyles: React.CSSProperties = {
  marginBottom: '16px'
};

const summaryBoxStyles: React.CSSProperties = {
  marginTop: '16px',
  padding: '12px 16px',
  borderRadius: '8px',
  backgroundColor: '#ecfdf5',
  border: '1px solid #6ee7b7',
  color: '#065f46',
  fontSize: '16px',
  fontWeight: 500
};

const warningBoxStyles: React.CSSProperties = {
  marginTop: '16px',
  padding: '12px 16px',
  borderRadius: '8px',
  backgroundColor: '#fff7ed',
  border: '1px solid #fdba74',
  color: '#9a3412'
};

const warningTitleStyles: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 'bold',
  marginBottom: '8px'
};

const warningListStyles: React.CSSProperties = {
  margin: 0,
  paddingLeft: '18px'
};

const imageWrapperStyles: React.CSSProperties = {
  position: 'relative',
  display: 'inline-block',
  marginTop: '16px',
  border: '2px solid #e5e7eb',
  borderRadius: '8px',
  overflow: 'hidden'
};

const imageStyles: React.CSSProperties = {
  maxWidth: '600px',
  maxHeight: '400px',
  display: 'block'
};

const contentLayoutStyles: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '24px',
  justifyContent: 'center',
  alignItems: 'flex-start',
  width: '100%',
  marginTop: '24px'
};

const scorecardContainerStyles: React.CSSProperties = {
  flex: '1 1 480px',
  minWidth: '320px',
  maxWidth: '640px'
};

const emptyStateStyles: React.CSSProperties = {
  marginTop: '56px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  gap: '12px',
  color: '#475569'
};

const emptyStateTitleStyles: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 700,
  color: '#0f172a'
};

const emptyStateTextStyles: React.CSSProperties = {
  fontSize: '16px',
  maxWidth: '480px',
  lineHeight: 1.5
};

function App() {
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

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageData = e.target?.result as string;
        setUploadedImage(imageData);
        setExtractionError(null);
        setIsProcessing(true);
        
        try {
          const result = await extractScoresFromImage(file);
          
          if (result.success && result.games && result.games.length > 0) {
            setGames(result.games);
            setCurrentGameIndex(0);
          } else {
            setExtractionError(result.error || 'Failed to extract scores');
          }
        } catch (error) {
          setExtractionError(`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const loadTestImage = useCallback(async () => {
    try {
      setIsProcessing(true);
      setExtractionError(null);
      const response = await fetch('/test-scorecard.jpg');
      const blob = await response.blob();
      
      // Convert to base64 data URL for OpenAI API
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        
        setUploadedImage(dataUrl);
        setExtractionError(null);
        
        try {
          // Process the image with OpenAI
          const result = await extractScoresFromImage(dataUrl);
          
          if (result.success && result.games && result.games.length > 0) {
            setGames(result.games);
            setCurrentGameIndex(0);
          } else {
            setExtractionError(result.error || 'Failed to extract scores from test image');
            console.log('Raw OpenAI response:', result.rawText);
          }
        } catch (error) {
          setExtractionError(`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
          setIsProcessing(false);
        }
      };
      
      reader.readAsDataURL(blob);
      
    } catch (error) {
      setExtractionError(`Failed to load test image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsProcessing(false);
    }
  }, []);

  const shouldAutoLoadTestImage = process.env.REACT_APP_ENABLE_AUTO_TEST_IMAGE === 'true';

  useEffect(() => {
    if (shouldAutoLoadTestImage) {
      loadTestImage();
    } else {
      setGames([]);
      setCurrentGameIndex(0);
      setUploadedImage(null);
      setExtractionError(null);
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

  const responsiveButtonContainerStyles = useMemo<React.CSSProperties>(
    () => ({
      ...buttonContainerStyles,
      flexDirection: isMobile ? ('column' as const) : ('row' as const),
      alignItems: isMobile ? ('stretch' as const) : ('center' as const),
      gap: isMobile ? '12px' : buttonContainerStyles.gap
    }),
    [isMobile]
  );

  const responsiveLayoutStyles = useMemo<React.CSSProperties>(
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

      {uploadedImage && displayedGame ? (
        <div style={uploadContainerStyles}>
          <div style={responsiveLayoutStyles}>
            <div style={responsiveImageWrapperStyles}>
              <img src={uploadedImage} alt="Uploaded scorecard" style={responsiveImageStyles} />
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
      ) : displayedGame ? (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginTop: '24px'
            }}
          >
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
          {hasMultipleGames && <div style={{ marginTop: '16px' }}>{paginationControls}</div>}
        </>
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
        </div>
      )}
    </div>
  );
}

export default App;
