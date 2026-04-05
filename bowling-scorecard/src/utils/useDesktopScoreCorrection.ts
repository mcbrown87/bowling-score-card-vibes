import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { Game } from '../types/bowling';
import {
  type ActiveRoll,
  applyDesktopScoreKey,
  getFirstEditableRoll
} from './frameCorrection';

interface UseDesktopScoreCorrectionArgs {
  enabled: boolean;
  game: Game | null;
  gameKey: string | null;
  canEdit: boolean;
  isBlocked?: boolean;
  onOptimisticChange?: (updatedGame: Game) => void;
  onPersist?: (updatedGame: Game) => Promise<void> | void;
  onPersistError?: (message: string) => void;
}

interface UseDesktopScoreCorrectionResult {
  displayGame: Game | null;
  selectedFrameIndex: number | null;
  activeRoll: ActiveRoll | null;
  isKeyboardActive: boolean;
  isDesktopInlineEditing: boolean;
  handleFrameSelect: (frameIndex: number) => void;
  handleScorecardFocus: () => void;
  handleScorecardBlur: () => void;
  handleScorecardKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  clearSelection: () => void;
}

export const useDesktopScoreCorrection = ({
  enabled,
  game,
  gameKey,
  canEdit,
  isBlocked = false,
  onOptimisticChange,
  onPersist,
  onPersistError
}: UseDesktopScoreCorrectionArgs): UseDesktopScoreCorrectionResult => {
  const [draftGame, setDraftGame] = useState<Game | null>(game);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number | null>(null);
  const [activeRoll, setActiveRoll] = useState<ActiveRoll | null>(null);
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPendingRef = useRef<Game | null>(null);
  const persistInFlightRef = useRef(false);
  const currentGameRef = useRef<Game | null>(game);

  useEffect(() => {
    currentGameRef.current = game;
  }, [game]);

  useEffect(() => {
    setDraftGame(currentGameRef.current);
    setSelectedFrameIndex(null);
    setActiveRoll(null);
    setIsKeyboardActive(false);
    latestPendingRef.current = null;
    persistInFlightRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [gameKey]);

  useEffect(() => {
    if (latestPendingRef.current || persistInFlightRef.current) {
      return;
    }
    setDraftGame(game);
  }, [game]);

  useEffect(() => {
    if (enabled) {
      return;
    }
    setSelectedFrameIndex(null);
    setActiveRoll(null);
    setIsKeyboardActive(false);
  }, [enabled]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const flushPersist = useCallback(async () => {
    if (!onPersist || persistInFlightRef.current || !latestPendingRef.current) {
      return;
    }

    const nextGame = latestPendingRef.current;
    latestPendingRef.current = null;
    persistInFlightRef.current = true;

    try {
      await onPersist(nextGame);
    } catch (error) {
      onPersistError?.(
        error instanceof Error ? error.message : 'Failed to save your correction'
      );
    } finally {
      persistInFlightRef.current = false;
      if (latestPendingRef.current) {
        void flushPersist();
      }
    }
  }, [onPersist, onPersistError]);

  const schedulePersist = useCallback(
    (nextGame: Game) => {
      if (!onPersist) {
        return;
      }
      latestPendingRef.current = nextGame;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void flushPersist();
      }, 250);
    },
    [flushPersist, onPersist]
  );

  const handleFrameSelect = useCallback(
    (frameIndex: number) => {
      if (!enabled || !canEdit || isBlocked || !draftGame) {
        return;
      }

      setSelectedFrameIndex(frameIndex);
      setActiveRoll(getFirstEditableRoll(draftGame, frameIndex));
      setIsKeyboardActive(true);
    },
    [canEdit, draftGame, enabled, isBlocked]
  );

  const clearSelection = useCallback(() => {
    setSelectedFrameIndex(null);
    setActiveRoll(null);
    setIsKeyboardActive(false);
  }, []);

  const handleScorecardFocus = useCallback(() => {
    if (!enabled || !canEdit || isBlocked) {
      return;
    }
    setIsKeyboardActive(true);
  }, [canEdit, enabled, isBlocked]);

  const handleScorecardBlur = useCallback(() => {
    setIsKeyboardActive(false);
  }, []);

  const handleScorecardKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!enabled || !canEdit || isBlocked || !draftGame || selectedFrameIndex === null) {
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      const result = applyDesktopScoreKey(
        draftGame,
        selectedFrameIndex,
        activeRoll ?? getFirstEditableRoll(draftGame, selectedFrameIndex),
        event.key
      );

      if (!result.changed && result.frameIndex === selectedFrameIndex && result.activeRoll === activeRoll) {
        return;
      }

      event.preventDefault();
      setSelectedFrameIndex(result.frameIndex);
      setActiveRoll(result.activeRoll);
      setIsKeyboardActive(true);

      if (!result.changed) {
        return;
      }

      const updatedGame = { ...result.game, isEstimate: false };
      setDraftGame(updatedGame);
      onOptimisticChange?.(updatedGame);
      schedulePersist(updatedGame);
    },
    [
      activeRoll,
      canEdit,
      draftGame,
      enabled,
      isBlocked,
      onOptimisticChange,
      schedulePersist,
      selectedFrameIndex
    ]
  );

  return useMemo(
    () => ({
      displayGame: draftGame,
      selectedFrameIndex,
      activeRoll,
      isKeyboardActive,
      isDesktopInlineEditing: enabled && canEdit,
      handleFrameSelect,
      handleScorecardFocus,
      handleScorecardBlur,
      handleScorecardKeyDown,
      clearSelection
    }),
    [
      activeRoll,
      canEdit,
      draftGame,
      enabled,
      handleFrameSelect,
      handleScorecardBlur,
      handleScorecardFocus,
      handleScorecardKeyDown,
      isKeyboardActive,
      selectedFrameIndex,
      clearSelection
    ]
  );
};
