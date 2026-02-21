'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { StoredGameSummary, StoredImageSummary } from '@/types/stored-image';
import { loadStoredImages } from '@/utils/storedImages';
import { Scorecard } from './Scorecard';

type PlayerGameEntry = {
  key: string;
  game: StoredGameSummary;
  image: StoredImageSummary;
};

type PlayerGroup = {
  playerName: string;
  games: PlayerGameEntry[];
};

const pageStyles: CSSProperties = {
  width: '100%',
  marginTop: '12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px'
};

const headerStyles: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '12px'
};

const titleStyles: CSSProperties = {
  margin: 0,
  fontSize: '24px',
  fontWeight: 800,
  color: '#f8fafc'
};

const summaryPillStyles: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 12px',
  borderRadius: '999px',
  backgroundColor: '#0f224a',
  color: '#dbeafe',
  fontWeight: 700,
  fontSize: '13px'
};

const layoutStyles: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(240px, 320px) 1fr',
  gap: '16px',
  alignItems: 'start'
};

const panelStyles: CSSProperties = {
  background: 'linear-gradient(180deg, #0b1738 0%, #08102a 100%)',
  borderRadius: '14px',
  border: '1px solid #334155',
  boxShadow: '0 12px 30px rgba(2, 6, 23, 0.4)',
  padding: '16px'
};

const sectionTitleStyles: CSSProperties = {
  margin: '0 0 12px',
  fontSize: '16px',
  fontWeight: 800,
  color: '#f8fafc'
};

const playerListStyles: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px'
};

const playerButtonStyles: CSSProperties = {
  width: '100%',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px',
  borderRadius: '10px',
  border: '1px solid #475569',
  backgroundColor: '#0f172a',
  color: '#e2e8f0',
  cursor: 'pointer'
};

const playerButtonActiveStyles: CSSProperties = {
  ...playerButtonStyles,
  border: '2px solid #60a5fa',
  backgroundColor: '#0f224a',
  boxShadow: '0 10px 18px rgba(14, 116, 144, 0.2)'
};

const playerMetaStyles: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  alignItems: 'flex-start'
};

const badgeStyles: CSSProperties = {
  padding: '4px 8px',
  borderRadius: '999px',
  backgroundColor: '#1e293b',
  color: '#e2e8f0',
  fontSize: '12px',
  fontWeight: 700
};

const selectedGameMetaStyles: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: '8px'
};

const hintTextStyles: CSSProperties = {
  fontSize: '12px',
  color: '#93c5fd'
};

const errorBoxStyles: CSSProperties = {
  padding: '12px',
  borderRadius: '10px',
  backgroundColor: '#fef2f2',
  border: '1px solid #fecaca',
  color: '#b91c1c',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px'
};

const actionButtonStyles: CSSProperties = {
  padding: '8px 12px',
  borderRadius: '8px',
  border: 'none',
  backgroundColor: '#1d4ed8',
  color: '#ffffff',
  cursor: 'pointer',
  fontWeight: 700
};

const emptyStateStyles: CSSProperties = {
  padding: '24px',
  borderRadius: '12px',
  border: '1px dashed #475569',
  textAlign: 'center' as const,
  color: '#93c5fd'
};

const chartCardStyles: CSSProperties = {
  borderRadius: '12px',
  border: '1px solid #334155',
  backgroundColor: '#0f172a',
  padding: '16px',
  boxShadow: 'inset 0 1px 0 rgba(148, 163, 184, 0.2)'
};

const chartLegendStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap',
  fontSize: '12px',
  color: '#cbd5e1',
  marginBottom: '10px'
};

const legendSwatchStyles: CSSProperties = {
  width: '14px',
  height: '14px',
  borderRadius: '4px'
};

const chartHintStyles: CSSProperties = {
  fontSize: '12px',
  color: '#93c5fd',
  marginTop: '6px'
};

const dropdownStyles: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '10px',
  border: '1px solid #475569',
  backgroundColor: '#0f172a',
  fontSize: '14px',
  fontWeight: 600,
  color: '#e2e8f0'
};

type ScoreTimelinePoint = {
  index: number;
  key: string;
  score: number;
  createdAt: string;
  label: string;
  isEstimate: boolean;
};

type ScoreTimelineProps = {
  data: ScoreTimelinePoint[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
};

const ScoreTimeline = ({ data, selectedKey, onSelect }: ScoreTimelineProps) => {
  const width = 900;
  const height = 260;
  const padding = 42;
  const scores = data.map((item) => item.score);
  const minScore = Math.min(...scores, 0);
  const maxScore = Math.max(...scores, 0);
  const range = Math.max(maxScore - minScore, 30);
  const xStep = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;

  const points = data.map((item, idx) => {
    const x = padding + xStep * idx;
    const normalized = (item.score - minScore) / range;
    const y = padding + (1 - normalized) * (height - padding * 2);
    return { ...item, x, y };
  });

  const polylinePoints = points.map((pt) => `${pt.x},${pt.y}`).join(' ');
  const yTicks = [minScore, Math.round(minScore + range / 2), maxScore].filter(
    (value, idx, arr) => arr.indexOf(value) === idx
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Bowling scores over time"
      style={{ width: '100%', height: 'auto' }}
    >
      <defs>
        <linearGradient id="score-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#2563eb" stopOpacity="0.16" />
          <stop offset="80%" stopColor="#2563eb" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={width} height={height} fill="#08102a" rx={12} />

      {yTicks.map((tick) => {
        const y =
          padding + (1 - (tick - minScore) / range) * (height - padding * 2);
        return (
          <g key={`grid-${tick}`}>
            <line
              x1={padding}
              x2={width - padding}
              y1={y}
              y2={y}
              stroke="#334155"
              strokeDasharray="4 4"
            />
            <text
              x={padding - 8}
              y={y + 4}
              textAnchor="end"
              fontSize="11"
              fill="#93c5fd"
            >
              {tick}
            </text>
          </g>
        );
      })}

      {points.length > 1 && (
        <>
          <polyline
            fill="url(#score-area)"
            stroke="none"
            points={`${points
              .map((pt) => `${pt.x},${pt.y}`)
              .join(' ')} ${points[points.length - 1].x},${height - padding} ${
              points[0].x
            },${height - padding}`}
          />
          <polyline
            fill="none"
            stroke="#2563eb"
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={polylinePoints}
          />
        </>
      )}

      {points.map((pt) => {
        const isSelected = selectedKey === pt.key;
        const color = isSelected ? '#f8fafc' : pt.isEstimate ? '#fb923c' : '#60a5fa';
        return (
          <g
            key={pt.key}
            onClick={() => onSelect(pt.key)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              cx={pt.x}
              cy={pt.y}
              r={isSelected ? 7 : 6}
              fill={color}
              stroke="#ffffff"
              strokeWidth={2}
            />
            <title>
              {pt.label} • Score {pt.score}
            </title>
          </g>
        );
      })}

      {points.map((pt) => (
        <text
          key={`label-${pt.key}`}
          x={pt.x}
          y={height - padding + 16}
          fontSize="10"
          fill="#93c5fd"
          textAnchor="middle"
        >
          {pt.index + 1}
        </text>
      ))}

      <text
        x={padding}
        y={height - padding + 30}
        fontSize="11"
        fill="#93c5fd"
      >
        Games (oldest to newest)
      </text>
    </svg>
  );
};

export function PlayerGamesBrowser() {
  const [images, setImages] = useState<StoredImageSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [selectedGameKey, setSelectedGameKey] = useState<string | null>(null);
  const [isStackedLayout, setIsStackedLayout] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const updateLayout = () => {
      if (typeof window === 'undefined') {
        return;
      }
      setIsStackedLayout(window.innerWidth < 900);
    };
    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

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

  const players = useMemo<PlayerGroup[]>(() => {
    const map = new Map<string, PlayerGroup>();
    images.forEach((image) => {
      image.games.forEach((game) => {
        const playerName = game.playerName || 'Unnamed player';
        const key = `${image.id}-${game.gameIndex}`;
        const entry = map.get(playerName) ?? { playerName, games: [] };
        entry.games.push({ key, game, image });
        map.set(playerName, entry);
      });
    });

    return Array.from(map.values()).sort((a, b) => {
      if (b.games.length !== a.games.length) {
        return b.games.length - a.games.length;
      }
      return a.playerName.localeCompare(b.playerName);
    });
  }, [images]);

  useEffect(() => {
    if (!selectedPlayer && players.length > 0) {
      setSelectedPlayer(players[0].playerName);
      setSelectedGameKey(players[0].games[0]?.key ?? null);
    }
  }, [players, selectedPlayer]);

  useEffect(() => {
    const activePlayer = players.find((player) => player.playerName === selectedPlayer);
    if (activePlayer && activePlayer.games.length > 0) {
      if (!selectedGameKey || !activePlayer.games.some((entry) => entry.key === selectedGameKey)) {
        setSelectedGameKey(activePlayer.games[0].key);
      }
    }
  }, [players, selectedPlayer, selectedGameKey]);

  const selectedPlayerGroup = useMemo(
    () => players.find((player) => player.playerName === selectedPlayer) ?? null,
    [players, selectedPlayer]
  );

  const selectedGame = useMemo(() => {
    if (!selectedPlayerGroup) {
      return null;
    }
    return (
      selectedPlayerGroup.games.find((entry) => entry.key === selectedGameKey) ??
      selectedPlayerGroup.games[0] ??
      null
    );
  }, [selectedGameKey, selectedPlayerGroup]);

  const playerStats = useMemo(() => {
    if (!selectedPlayerGroup) {
      return null;
    }
    const totals = selectedPlayerGroup.games.map((entry) => entry.game.totalScore || 0);
    const best = totals.length ? Math.max(...totals) : 0;
    const average = totals.length
      ? totals.reduce((sum, value) => sum + value, 0) / totals.length
      : 0;
    const lastPlayed = selectedPlayerGroup.games
      .map((entry) => entry.image.createdAt)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
    return {
      count: selectedPlayerGroup.games.length,
      best,
      average: Math.round(average),
      lastPlayed
    };
  }, [selectedPlayerGroup]);

  const totalGamesCount = useMemo(
    () => images.reduce((count, image) => count + image.games.length, 0),
    [images]
  );

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (err) {
      return iso;
    }
  };

  const formatShortDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
      });
    } catch (err) {
      return iso;
    }
  };

  const timelineData = useMemo(() => {
    if (!selectedPlayerGroup) {
      return [];
    }
    return selectedPlayerGroup.games
      .slice()
      .sort(
        (a, b) =>
          new Date(a.image.createdAt).getTime() - new Date(b.image.createdAt).getTime()
      )
      .map((entry, index) => ({
        index,
        key: entry.key,
        score: entry.game.totalScore || 0,
        createdAt: entry.image.createdAt,
        label:
          entry.image.originalFileName ??
          `Game ${index + 1} on ${formatShortDate(entry.image.createdAt)}`,
      isEstimate: Boolean(entry.game.isEstimate)
    }));
  }, [selectedPlayerGroup]);

  const handleOpenInLibrary = useCallback(() => {
    if (!selectedGame) {
      return;
    }
    const params = new URLSearchParams();
    params.set('imageId', selectedGame.image.id);
    params.set('gameIndex', String(selectedGame.game.gameIndex));
    router.push(`/library?${params.toString()}`);
  }, [router, selectedGame]);

  const stackedLayout = isStackedLayout
    ? {
        ...layoutStyles,
        gridTemplateColumns: '1fr'
      }
    : layoutStyles;

  return (
    <section style={pageStyles}>
      <div style={headerStyles}>
        <div>
          <h2 style={titleStyles}>Games by player</h2>
          <p style={{ margin: '4px 0 0', color: '#93c5fd' }}>
            Browse every stored game grouped by bowler. Pick a player to review their scorecards side by side.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span style={summaryPillStyles}>
            {players.length} players · {totalGamesCount} games
          </span>
          <button
            type="button"
            onClick={() => {
              void fetchImages();
            }}
            style={actionButtonStyles}
            disabled={isLoading}
          >
            {isLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div style={errorBoxStyles} role="alert">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              void fetchImages();
            }}
            style={actionButtonStyles}
          >
            Try again
          </button>
        </div>
      )}

      {isLoading && players.length === 0 && (
        <p style={{ color: '#7dd3fc', margin: '4px 0 0' }}>Loading player games…</p>
      )}

      {!isLoading && players.length === 0 && (
        <div style={emptyStateStyles}>
          <p style={{ margin: 0, fontWeight: 700, color: '#f8fafc' }}>No games saved yet</p>
          <p style={{ margin: '6px 0 0' }}>
            Upload a scorecard to start tracking games per player.
          </p>
        </div>
      )}

      {players.length > 0 && (
        <div style={stackedLayout}>
          {!isStackedLayout && (
            <div style={panelStyles}>
              <h3 style={sectionTitleStyles}>Players</h3>
              <div style={playerListStyles}>
                {players.map((player) => {
                  const isActive = player.playerName === selectedPlayer;
                  const scores = player.games.map((entry) => entry.game.totalScore || 0);
                  const bestScore = scores.length ? Math.max(...scores) : 0;
                  return (
                    <button
                      type="button"
                      key={player.playerName}
                      onClick={() => {
                        setSelectedPlayer(player.playerName);
                        setSelectedGameKey(player.games[0]?.key ?? null);
                      }}
                      style={isActive ? playerButtonActiveStyles : playerButtonStyles}
                    >
                      <div style={playerMetaStyles}>
                        <span style={{ fontWeight: 800, color: '#f8fafc' }}>{player.playerName}</span>
                        <span style={{ color: '#cbd5e1', fontSize: '13px' }}>
                          {player.games.length} game{player.games.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      <span style={badgeStyles}>Best: {bestScore}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={panelStyles}>
            <h3 style={sectionTitleStyles}>Games</h3>
            {selectedPlayerGroup && playerStats ? (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  <span style={badgeStyles}>Total: {playerStats.count}</span>
                  <span style={badgeStyles}>Best: {playerStats.best}</span>
                  <span style={badgeStyles}>Average: {playerStats.average}</span>
                  <span style={badgeStyles}>
                    Last played: {playerStats.lastPlayed ? formatDate(playerStats.lastPlayed) : '—'}
                  </span>
                </div>

                <div style={chartCardStyles}>
                  <div style={chartLegendStyles}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ ...legendSwatchStyles, backgroundColor: '#60a5fa' }} />
                      <span>Corrected</span>
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ ...legendSwatchStyles, backgroundColor: '#fb923c' }} />
                      <span>Estimate</span>
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ ...legendSwatchStyles, backgroundColor: '#f8fafc' }} />
                      <span>Selected</span>
                    </div>
                  </div>
                  {timelineData.length > 0 ? (
                    <ScoreTimeline
                      data={timelineData}
                      onSelect={(key) => setSelectedGameKey(key)}
                      selectedKey={selectedGame?.key ?? null}
                    />
                  ) : (
                    <p style={hintTextStyles}>No chartable games yet.</p>
                  )}
                  <p style={chartHintStyles}>
                    Click a point to open the scorecard. Time runs left to right.
                  </p>
                </div>

                {isStackedLayout && (
                  <div style={{ marginTop: '12px' }}>
                    <label htmlFor="player-select" style={{ ...hintTextStyles, display: 'block', marginBottom: '6px' }}>
                      Choose player
                    </label>
                    <select
                      id="player-select"
                      style={dropdownStyles}
                      value={selectedPlayer ?? ''}
                      onChange={(e) => {
                        const next = e.target.value;
                        const target = players.find((p) => p.playerName === next);
                        setSelectedPlayer(next);
                        setSelectedGameKey(target?.games[0]?.key ?? null);
                      }}
                    >
                      {players.map((player) => (
                        <option key={player.playerName} value={player.playerName}>
                          {player.playerName} ({player.games.length})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedGame ? (
                  <div style={{ marginTop: '14px' }}>
                    <div style={selectedGameMetaStyles}>
                      <div style={{ fontWeight: 700, color: '#f8fafc' }}>
                        Viewing {selectedPlayerGroup.playerName} — score {selectedGame.game.totalScore}
                      </div>
                      <div style={hintTextStyles}>
                        Source: {selectedGame.image.originalFileName ?? 'Uploaded image'} ·{' '}
                        {formatDate(selectedGame.image.createdAt)}
                      </div>
                    </div>
                    <div
                      style={{ marginTop: '8px', cursor: 'pointer' }}
                      role="button"
                      tabIndex={0}
                      onClick={handleOpenInLibrary}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleOpenInLibrary();
                        }
                      }}
                      aria-label="Open this game in the library view"
                    >
                      <Scorecard game={selectedGame.game} disableEditing compact />
                    </div>
                    <p style={{ ...hintTextStyles, marginTop: '6px' }}>
                      Click the scorecard to jump to the library with this game selected.
                    </p>
                  </div>
                ) : (
                  <p style={{ ...hintTextStyles, marginTop: '8px' }}>
                    Select a game to view the frames.
                  </p>
                )}
              </>
            ) : (
              <p style={hintTextStyles}>Select a player to see their games.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
