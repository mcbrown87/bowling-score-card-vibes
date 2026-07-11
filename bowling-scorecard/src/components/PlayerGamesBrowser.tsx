'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { StoredGameSummary, StoredImageSummary } from '@/types/stored-image';
import {
  buildFrameTrendSeries,
  buildPlayerFrameHeatmap
} from '@/utils/playerFrameHeatmap';
import { loadStoredImages } from '@/utils/storedImages';
import { useDesktopKeyboardMode } from '@/utils/useDesktopKeyboardMode';
import { Scorecard } from './Scorecard';

type PlayerGameEntry = {
  key: string;
  game: StoredGameSummary;
  games: StoredGameSummary[];
  image: StoredImageSummary;
  score: number;
};

type PlayerGroup = {
  playerKey: string;
  playerName: string;
  games: PlayerGameEntry[];
};

type GamesBrowserMode = 'players' | 'teams';

type GamesBrowserCopy = {
  title: string;
  description: string;
  summaryLabel: string;
  itemSingular: string;
  itemPlural: string;
  listTitle: string;
  loadingText: string;
  emptyTitle: string;
  emptyDescription: string;
  mobileChooseLabel: string;
  selectPrompt: string;
};

const gamesBrowserCopy: Record<GamesBrowserMode, GamesBrowserCopy> = {
  players: {
    title: 'Games by player',
    description:
      'Browse every stored game grouped by bowler. Pick a player to review their scorecards side by side.',
    summaryLabel: 'players',
    itemSingular: 'game',
    itemPlural: 'games',
    listTitle: 'Players',
    loadingText: 'Loading player games…',
    emptyTitle: 'No games saved yet',
    emptyDescription: 'Upload a scorecard to start tracking games per player.',
    mobileChooseLabel: 'Choose player',
    selectPrompt: 'Select a player to see their games.'
  },
  teams: {
    title: 'Games by team',
    description:
      'Browse every stored game grouped by team. Pick a team to review its scorecards side by side.',
    summaryLabel: 'teams',
    itemSingular: 'scorecard',
    itemPlural: 'scorecards',
    listTitle: 'Teams',
    loadingText: 'Loading team games…',
    emptyTitle: 'No team games saved yet',
    emptyDescription: 'Assign a team to a scorecard in the library to start tracking team history.',
    mobileChooseLabel: 'Choose team',
    selectPrompt: 'Select a team to see its games.'
  }
};

const gameLimitOptions = [
  { label: 'All games', value: 0 },
  { label: 'Last game', value: 1 },
  { label: 'Last 5 games', value: 5 },
  { label: 'Last 10 games', value: 10 },
  { label: 'Last 25 games', value: 25 }
];

const PLAYER_GAMES_PAGE_SIZE = 50;
const rollingAverageOptions = [3, 6, 9];
type RollingAverageDisplayMode = 'averageAndStdDev' | 'averageOnly' | 'hidden';
type FrameTrendDisplayMode = 'rawAndAverage' | 'averageOnly' | 'rawOnly' | 'hidden';

const nextRollingAverageDisplayMode = (
  current: RollingAverageDisplayMode
): RollingAverageDisplayMode => {
  if (current === 'averageAndStdDev') {
    return 'averageOnly';
  }
  if (current === 'averageOnly') {
    return 'hidden';
  }
  return 'averageAndStdDev';
};

const getRollingAverageDisplayLabel = (mode: RollingAverageDisplayMode) => {
  if (mode === 'averageAndStdDev') {
    return 'Show rolling average only';
  }
  if (mode === 'averageOnly') {
    return 'Hide rolling average';
  }
  return 'Show rolling average and standard deviation';
};

const sortPlayerGamesByCreatedAt = (games: PlayerGameEntry[]) =>
  games
    .slice()
    .sort(
      (a, b) => new Date(b.image.createdAt).getTime() - new Date(a.image.createdAt).getTime()
    );

const getNewestPlayerGame = (games: PlayerGameEntry[]) =>
  sortPlayerGamesByCreatedAt(games)[0] ?? null;

const getGameScore = (game: StoredGameSummary) => {
  const totalScore =
    typeof game.totalScore === 'number' && Number.isFinite(game.totalScore)
      ? game.totalScore
      : 0;
  const finalFrameScore =
    typeof game.tenthFrame.score === 'number' && Number.isFinite(game.tenthFrame.score)
      ? game.tenthFrame.score
      : 0;
  return Math.max(totalScore, finalFrameScore);
};

const getImageTeamScore = (image: StoredImageSummary) =>
  image.games.reduce((sum, game) => sum + getGameScore(game), 0);

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

const scoreLegendSwatchStyles: CSSProperties = {
  width: '28px',
  height: '0',
  borderTop: '3px solid #2563eb'
};

const trendLegendSwatchStyles: CSSProperties = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  width: '34px',
  height: '14px'
};

const trendLegendBandStyles: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: '3px',
  height: '8px',
  borderRadius: '999px',
  backgroundColor: 'rgba(34, 211, 238, 0.18)'
};

const trendLegendLineStyles: CSSProperties = {
  position: 'relative',
  width: '34px',
  height: 0,
  borderTop: '3px dashed #22d3ee'
};

const lineLegendItemStyles: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  color: '#cbd5e1'
};

const lineLegendToggleStyles: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: 0,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer'
};

const lineLegendTextButtonStyles: CSSProperties = {
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: '#cbd5e1',
  font: 'inherit',
  cursor: 'pointer'
};

const chartHintStyles: CSSProperties = {
  fontSize: '12px',
  color: '#93c5fd',
  marginTop: '6px'
};

const heatmapLegendStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  flexWrap: 'wrap',
  marginTop: '10px'
};

const heatmapScaleStyles: CSSProperties = {
  width: '160px',
  height: '10px',
  borderRadius: '999px',
  background:
    'linear-gradient(90deg, rgba(248, 113, 113, 0.12) 0%, rgba(220, 38, 38, 0.78) 100%)',
  border: '1px solid rgba(248, 113, 113, 0.28)'
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

const compactDropdownStyles: CSSProperties = {
  ...dropdownStyles,
  width: 'auto',
  minWidth: '150px'
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
  rollingAverageWindow: number;
  showScoreLine: boolean;
  rollingAverageDisplayMode: RollingAverageDisplayMode;
  xAxisLabel?: string;
  selectedKey: string | null;
  onSelect: (key: string) => void;
};

const ScoreTimeline = ({
  data,
  rollingAverageWindow,
  showScoreLine,
  rollingAverageDisplayMode,
  xAxisLabel = 'Games',
  selectedKey,
  onSelect
}: ScoreTimelineProps) => {
  const width = 900;
  const height = 260;
  const padding = 42;
  const showRollingAverageLine = rollingAverageDisplayMode !== 'hidden';
  const showRollingStdDevBand = rollingAverageDisplayMode === 'averageAndStdDev';
  const dataWithAverages = data.map((item, idx) => {
    const windowStart = Math.max(0, idx - rollingAverageWindow + 1);
    const windowScores = data.slice(windowStart, idx + 1).map((entry) => entry.score);
    const rollingAverage =
      windowScores.reduce((sum, score) => sum + score, 0) / windowScores.length;
    const rollingStdDev = Math.sqrt(
      windowScores.reduce(
        (sum, score) => sum + Math.pow(score - rollingAverage, 2),
        0
      ) / windowScores.length
    );

    return {
      ...item,
      rollingAverage,
      rollingStdDev,
      rollingStdDevUpper: rollingAverage + rollingStdDev,
      rollingStdDevLower: rollingAverage - rollingStdDev
    };
  });
  const scores = dataWithAverages.flatMap((item) => [
    item.score,
    item.rollingAverage,
    item.rollingStdDevUpper,
    item.rollingStdDevLower
  ]);
  const minScore = Math.min(...scores, 0);
  const maxScore = Math.max(...scores, 0);
  const range = Math.max(maxScore - minScore, 30);
  const xStep = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;

  const points = dataWithAverages.map((item, idx) => {
    const x = padding + xStep * idx;
    const normalized = (item.score - minScore) / range;
    const normalizedAverage = (item.rollingAverage - minScore) / range;
    const normalizedStdDevUpper = (item.rollingStdDevUpper - minScore) / range;
    const normalizedStdDevLower = (item.rollingStdDevLower - minScore) / range;
    const y = padding + (1 - normalized) * (height - padding * 2);
    const averageY = padding + (1 - normalizedAverage) * (height - padding * 2);
    const stdDevUpperY =
      padding + (1 - normalizedStdDevUpper) * (height - padding * 2);
    const stdDevLowerY =
      padding + (1 - normalizedStdDevLower) * (height - padding * 2);
    return { ...item, x, y, averageY, stdDevUpperY, stdDevLowerY };
  });

  const polylinePoints = points.map((pt) => `${pt.x},${pt.y}`).join(' ');
  const rollingAveragePoints = points.map((pt) => `${pt.x},${pt.averageY}`).join(' ');
  const rollingStdDevBandPoints = [
    ...points.map((pt) => `${pt.x},${pt.stdDevUpperY}`),
    ...points
      .slice()
      .reverse()
      .map((pt) => `${pt.x},${pt.stdDevLowerY}`)
  ].join(' ');
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
              {Math.round(tick)}
            </text>
          </g>
        );
      })}

      {points.length > 1 && (
        <>
          {showScoreLine && (
            <polyline
              fill="url(#score-area)"
              stroke="none"
              points={`${points
                .map((pt) => `${pt.x},${pt.y}`)
                .join(' ')} ${points[points.length - 1].x},${height - padding} ${
                points[0].x
              },${height - padding}`}
            />
          )}
          {showScoreLine && (
            <polyline
              data-testid="score-line"
              fill="none"
              stroke="#2563eb"
              strokeWidth={3}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={polylinePoints}
            />
          )}
          {showRollingStdDevBand && (
            <polygon
              data-testid="rolling-stddev-band"
              fill="rgba(34, 211, 238, 0.18)"
              stroke="rgba(34, 211, 238, 0.3)"
              strokeWidth={1}
              points={rollingStdDevBandPoints}
            />
          )}
          {showRollingAverageLine && (
            <polyline
              data-testid="rolling-average-line"
              fill="none"
              stroke="#22d3ee"
              strokeWidth={4}
              strokeDasharray="10 8"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={rollingAveragePoints}
            />
          )}
        </>
      )}

      {showScoreLine &&
        points.map((pt) => {
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
                {showRollingAverageLine
                  ? ` • ${rollingAverageWindow}-game avg ${Math.round(
                      pt.rollingAverage
                    )} • std dev ${Math.round(pt.rollingStdDev)}`
                  : ''}
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
        {xAxisLabel} (oldest to newest)
      </text>
    </svg>
  );
};

type PlayerGamesBrowserProps = {
  mode?: GamesBrowserMode;
};

export function PlayerGamesBrowser({ mode = 'players' }: PlayerGamesBrowserProps) {
  const [images, setImages] = useState<StoredImageSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlayerKey, setSelectedPlayerKey] = useState<string | null>(null);
  const [selectedGameKey, setSelectedGameKey] = useState<string | null>(null);
  const [gameLimit, setGameLimit] = useState(0);
  const [rollingAverageWindow, setRollingAverageWindow] = useState(rollingAverageOptions[0]);
  const [showScoreLine, setShowScoreLine] = useState(true);
  const [rollingAverageDisplayMode, setRollingAverageDisplayMode] =
    useState<RollingAverageDisplayMode>('averageAndStdDev');
  const [isStackedLayout, setIsStackedLayout] = useState(false);
  const router = useRouter();
  const isHoverCapable = useDesktopKeyboardMode();
  const copy = gamesBrowserCopy[mode];

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
      const firstPage = await loadStoredImages(1, PLAYER_GAMES_PAGE_SIZE);
      const remainingPages =
        firstPage.totalPages > 1
          ? await Promise.all(
              Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
                loadStoredImages(index + 2, PLAYER_GAMES_PAGE_SIZE)
              )
            )
          : [];
      setImages([firstPage, ...remainingPages].flatMap((page) => page.images));
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
      if (mode === 'teams') {
        if (!image.team || image.games.length === 0) {
          return;
        }

        const playerName = image.team.name;
        const playerKey = image.team.id;
        const entry = map.get(playerKey) ?? { playerKey, playerName, games: [] };
        entry.games.push({
          key: image.id,
          game: image.games[0],
          games: image.games,
          image,
          score: getImageTeamScore(image)
        });
        map.set(playerKey, entry);
        return;
      }

      image.games.forEach((game) => {
        const playerName = game.playerName || 'Unnamed player';
        const playerKey = game.player?.id ?? `name:${playerName}`;
        const key = `${image.id}-${game.gameIndex}`;
        const entry = map.get(playerKey) ?? { playerKey, playerName, games: [] };
        entry.games.push({ key, game, games: [game], image, score: getGameScore(game) });
        map.set(playerKey, entry);
      });
    });

    return Array.from(map.values()).sort((a, b) => {
      if (b.games.length !== a.games.length) {
        return b.games.length - a.games.length;
      }
      return a.playerName.localeCompare(b.playerName);
    });
  }, [images, mode]);

  useEffect(() => {
    if (players.length === 0) {
      setSelectedPlayerKey(null);
      setSelectedGameKey(null);
      return;
    }

    if (!selectedPlayerKey || !players.some((player) => player.playerKey === selectedPlayerKey)) {
      setSelectedPlayerKey(players[0].playerKey);
      setSelectedGameKey(getNewestPlayerGame(players[0].games)?.key ?? null);
    }
  }, [players, selectedPlayerKey]);

  useEffect(() => {
    const activePlayer = players.find((player) => player.playerKey === selectedPlayerKey);
    if (activePlayer && activePlayer.games.length > 0) {
      if (!selectedGameKey || !activePlayer.games.some((entry) => entry.key === selectedGameKey)) {
        setSelectedGameKey(getNewestPlayerGame(activePlayer.games)?.key ?? null);
      }
    }
  }, [players, selectedPlayerKey, selectedGameKey]);

  const selectedPlayerGroup = useMemo(
    () => players.find((player) => player.playerKey === selectedPlayerKey) ?? null,
    [players, selectedPlayerKey]
  );

  const visiblePlayerGames = useMemo(() => {
    if (!selectedPlayerGroup) {
      return [];
    }

    const sortedGames = sortPlayerGamesByCreatedAt(selectedPlayerGroup.games);
    return gameLimit > 0 ? sortedGames.slice(0, gameLimit) : sortedGames;
  }, [gameLimit, selectedPlayerGroup]);

  useEffect(() => {
    if (selectedPlayerGroup && visiblePlayerGames.length > 0) {
      if (!selectedGameKey || !visiblePlayerGames.some((entry) => entry.key === selectedGameKey)) {
        setSelectedGameKey(visiblePlayerGames[0].key);
      }
    }
  }, [selectedGameKey, selectedPlayerGroup, visiblePlayerGames]);

  const selectedGame = useMemo(() => {
    if (!selectedPlayerGroup) {
      return null;
    }
    return (
      visiblePlayerGames.find((entry) => entry.key === selectedGameKey) ??
      visiblePlayerGames[0] ??
      null
    );
  }, [selectedGameKey, selectedPlayerGroup, visiblePlayerGames]);

  const playerStats = useMemo(() => {
    if (!selectedPlayerGroup) {
      return null;
    }
    const totals = visiblePlayerGames.map((entry) => entry.score);
    const best = totals.length ? Math.max(...totals) : 0;
    const average = totals.length
      ? totals.reduce((sum, value) => sum + value, 0) / totals.length
      : 0;
    const lastPlayed = visiblePlayerGames
      .map((entry) => entry.image.createdAt)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
    return {
      count: visiblePlayerGames.length,
      totalCount: selectedPlayerGroup.games.length,
      best,
      average: Math.round(average),
      lastPlayed
    };
  }, [selectedPlayerGroup, visiblePlayerGames]);

  const totalGamesCount = useMemo(
    () =>
      mode === 'teams'
        ? players.reduce((count, player) => count + player.games.length, 0)
        : images.reduce((count, image) => count + image.games.length, 0),
    [images, mode, players]
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

    return visiblePlayerGames
      .slice()
      .sort(
        (a, b) =>
          new Date(a.image.createdAt).getTime() - new Date(b.image.createdAt).getTime()
      )
      .map((entry, index) => ({
        index,
        key: entry.key,
        score: entry.score,
        createdAt: entry.image.createdAt,
        label:
          entry.image.originalFileName ??
          `Game ${index + 1} on ${formatShortDate(entry.image.createdAt)}`,
        isEstimate: Boolean(entry.game.isEstimate)
      }));
  }, [selectedPlayerGroup, visiblePlayerGames]);

  const frameTrendSeries = useMemo(() => {
    if (!selectedPlayerGroup || mode === 'teams') {
      return null;
    }

    const sortedGames = visiblePlayerGames
      .slice()
      .sort(
        (a, b) =>
          new Date(a.image.createdAt).getTime() - new Date(b.image.createdAt).getTime()
      )
      .map((entry) => entry.game);

    return buildFrameTrendSeries(sortedGames);
  }, [mode, selectedPlayerGroup, visiblePlayerGames]);

  const selectedTrendIndex = useMemo(() => {
    if (!selectedGame) {
      return null;
    }

    const matchIndex = timelineData.findIndex((entry) => entry.key === selectedGame.key);
    return matchIndex >= 0 ? matchIndex : null;
  }, [selectedGame, timelineData]);

  const frameHeatmap = useMemo(() => {
    if (!selectedPlayerGroup || mode === 'teams') {
      return null;
    }

    return buildPlayerFrameHeatmap(visiblePlayerGames.map((entry) => entry.game));
  }, [mode, selectedPlayerGroup, visiblePlayerGames]);

  const frameTrendDisplayMode = useMemo<FrameTrendDisplayMode>(() => {
    const showRollingAverage = rollingAverageDisplayMode !== 'hidden';
    if (showScoreLine && showRollingAverage) {
      return 'rawAndAverage';
    }
    if (showScoreLine) {
      return 'rawOnly';
    }
    if (showRollingAverage) {
      return 'averageOnly';
    }
    return 'hidden';
  }, [rollingAverageDisplayMode, showScoreLine]);

  const handleOpenInLibrary = useCallback(() => {
    if (!selectedGame) {
      return;
    }
    const params = new URLSearchParams();
    params.set('imageId', selectedGame.image.id);
    if (mode === 'players') {
      params.set('gameIndex', String(selectedGame.game.gameIndex));
    }
    const imageIndex = images.findIndex((image) => image.id === selectedGame.image.id);
    if (imageIndex >= 0) {
      params.set('page', String(Math.floor(imageIndex / PLAYER_GAMES_PAGE_SIZE) + 1));
    }
    router.push(`/library?${params.toString()}`);
  }, [images, mode, router, selectedGame]);

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
          <h2 style={titleStyles}>{copy.title}</h2>
          <p style={{ margin: '4px 0 0', color: '#93c5fd' }}>
            {copy.description}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span style={summaryPillStyles}>
            {players.length} {copy.summaryLabel} · {totalGamesCount}{' '}
            {totalGamesCount === 1 ? copy.itemSingular : copy.itemPlural}
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
        <p style={{ color: '#7dd3fc', margin: '4px 0 0' }}>{copy.loadingText}</p>
      )}

      {!isLoading && players.length === 0 && (
        <div style={emptyStateStyles}>
          <p style={{ margin: 0, fontWeight: 700, color: '#f8fafc' }}>
            {copy.emptyTitle}
          </p>
          <p style={{ margin: '6px 0 0' }}>
            {copy.emptyDescription}
          </p>
        </div>
      )}

      {players.length > 0 && (
        <div style={stackedLayout}>
          {!isStackedLayout && (
            <div style={panelStyles}>
              <h3 style={sectionTitleStyles}>{copy.listTitle}</h3>
              <div style={playerListStyles}>
                {players.map((player) => {
                  const isActive = player.playerKey === selectedPlayerKey;
                  const scores = player.games.map((entry) => entry.score);
                  const bestScore = scores.length ? Math.max(...scores) : 0;
                  return (
                    <button
                      type="button"
                      key={player.playerKey}
                      onClick={() => {
                        setSelectedPlayerKey(player.playerKey);
                        setSelectedGameKey(player.games[0]?.key ?? null);
                      }}
                      style={isActive ? playerButtonActiveStyles : playerButtonStyles}
                    >
                      <div style={playerMetaStyles}>
                        <span style={{ fontWeight: 800, color: '#f8fafc' }}>{player.playerName}</span>
                        <span style={{ color: '#cbd5e1', fontSize: '13px' }}>
                          {player.games.length}{' '}
                          {player.games.length === 1 ? copy.itemSingular : copy.itemPlural}
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
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    marginBottom: '12px'
                  }}
                >
                  <label htmlFor="game-limit-select" style={hintTextStyles}>
                    {mode === 'teams' ? 'Scorecards shown' : 'Games shown'}
                  </label>
                  <select
                    id="game-limit-select"
                    style={compactDropdownStyles}
                    value={gameLimit}
                    onChange={(event) => setGameLimit(Number(event.target.value))}
                  >
                    {gameLimitOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  <span style={badgeStyles}>
                    Showing: {playerStats.count}
                    {playerStats.totalCount !== playerStats.count ? ` of ${playerStats.totalCount}` : ''}
                  </span>
                  <span style={badgeStyles}>Best: {playerStats.best}</span>
                  <span style={badgeStyles}>Average: {playerStats.average}</span>
                  <span style={badgeStyles}>
                    Last played: {playerStats.lastPlayed ? formatDate(playerStats.lastPlayed) : '—'}
                  </span>
                </div>

                <div style={chartCardStyles}>
                  <div style={chartLegendStyles}>
                    <span style={lineLegendItemStyles}>
                      <button
                        type="button"
                        style={{
                          ...lineLegendToggleStyles,
                          opacity: showScoreLine ? 1 : 0.48
                        }}
                        onClick={() => setShowScoreLine((isVisible) => !isVisible)}
                        aria-pressed={showScoreLine}
                        aria-label={`${showScoreLine ? 'Hide' : 'Show'} score line`}
                      >
                        <span style={scoreLegendSwatchStyles} />
                      </button>
                      <span>Scores</span>
                    </span>
                    <span style={lineLegendItemStyles}>
                      <button
                        type="button"
                        style={{
                          ...lineLegendToggleStyles,
                          opacity: rollingAverageDisplayMode === 'hidden' ? 0.48 : 1
                        }}
                        onClick={() =>
                          setRollingAverageDisplayMode((current) =>
                            nextRollingAverageDisplayMode(current)
                          )
                        }
                        aria-pressed={rollingAverageDisplayMode !== 'hidden'}
                        aria-label={getRollingAverageDisplayLabel(rollingAverageDisplayMode)}
                      >
                        <span style={trendLegendSwatchStyles}>
                          {rollingAverageDisplayMode === 'averageAndStdDev' && (
                            <span style={trendLegendBandStyles} />
                          )}
                          <span style={trendLegendLineStyles} />
                        </span>
                      </button>
                      <button
                        type="button"
                        style={lineLegendTextButtonStyles}
                        onClick={() => {
                          setRollingAverageWindow((current) => {
                            const currentIndex = rollingAverageOptions.indexOf(current);
                            const nextIndex = (currentIndex + 1) % rollingAverageOptions.length;
                            return rollingAverageOptions[nextIndex];
                          });
                        }}
                        aria-label={`Change rolling average window. Current window is ${rollingAverageWindow} games.`}
                      >
                        {rollingAverageWindow}-game average
                      </button>
                    </span>
                  </div>
                  {timelineData.length > 0 ? (
                    <ScoreTimeline
                      data={timelineData}
                      rollingAverageWindow={rollingAverageWindow}
                      showScoreLine={showScoreLine}
                      rollingAverageDisplayMode={rollingAverageDisplayMode}
                      xAxisLabel={mode === 'teams' ? 'Scorecards' : 'Games'}
                      onSelect={(key) => setSelectedGameKey(key)}
                      selectedKey={selectedGame?.key ?? null}
                    />
                  ) : (
                    <p style={hintTextStyles}>No chartable games yet.</p>
                  )}
                  <p style={chartHintStyles}>
                    Click a point to open the {mode === 'teams' ? 'team scorecard image' : 'scorecard'}. Time runs left to right.
                  </p>
                </div>

                {isStackedLayout && (
                  <div style={{ marginTop: '12px' }}>
                    <label htmlFor="player-select" style={{ ...hintTextStyles, display: 'block', marginBottom: '6px' }}>
                      {copy.mobileChooseLabel}
                    </label>
                    <select
                      id="player-select"
                      style={dropdownStyles}
                      value={selectedPlayerKey ?? ''}
                      onChange={(e) => {
                        const next = e.target.value;
                        const target = players.find((p) => p.playerKey === next);
                        setSelectedPlayerKey(next);
                        setSelectedGameKey(target ? getNewestPlayerGame(target.games)?.key ?? null : null);
                      }}
                    >
                      {players.map((player) => (
                        <option key={player.playerKey} value={player.playerKey}>
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
                        Viewing {selectedPlayerGroup.playerName} — score {selectedGame.score}
                      </div>
                      <div style={hintTextStyles}>
                        Source: {selectedGame.image.originalFileName ?? 'Uploaded image'} ·{' '}
                        {formatDate(selectedGame.image.createdAt)}
                      </div>
                    </div>
                    {mode === 'players' ? (
                      <>
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
                          <Scorecard
                            game={selectedGame.game}
                            frameHeatmap={frameHeatmap ?? undefined}
                            frameTrendSeries={frameTrendSeries ?? undefined}
                            showFrameTrendPreview={
                              isHoverCapable && frameTrendDisplayMode !== 'hidden'
                            }
                            frameTrendWindow={rollingAverageWindow}
                            frameTrendDisplayMode={frameTrendDisplayMode}
                            selectedTrendIndex={selectedTrendIndex}
                            disableEditing
                            compact
                          />
                        </div>
                        <div style={heatmapLegendStyles}>
                          <span style={hintTextStyles}>Frame heatmap</span>
                          <div style={heatmapScaleStyles} aria-hidden="true" />
                          <span style={hintTextStyles}>Lower average gain</span>
                          <span style={hintTextStyles}>Higher average gain</span>
                        </div>
                        <p style={{ ...hintTextStyles, marginTop: '6px' }}>
                          Click the scorecard to jump to the library with this game selected. Darker red
                          frames mark where this player averages more points.
                        </p>
                      </>
                    ) : (
                      <div style={{ marginTop: '10px' }}>
                        <button
                          type="button"
                          onClick={handleOpenInLibrary}
                          style={actionButtonStyles}
                        >
                          Open team scorecard image
                        </button>
                        <p style={{ ...hintTextStyles, marginTop: '8px' }}>
                          Team scores are tracked as image totals. Frame-by-frame views are hidden for teams.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p style={{ ...hintTextStyles, marginTop: '8px' }}>
                    {mode === 'teams'
                      ? 'Select a scorecard to view its team total.'
                      : 'Select a game to view the frames.'}
                  </p>
                )}
              </>
            ) : (
              <p style={hintTextStyles}>{copy.selectPrompt}</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
