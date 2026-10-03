import { useEffect, useRef } from 'react';
import type { GameEvent } from '@ludo/engine';
import { useGameStore } from './store';
import { ENGINE_REV_SECONDS, playEventSound } from './sounds';

export const DICE_ROLL_MS = Math.round(ENGINE_REV_SECONDS * 1000);

export function useEventQueue(): void {
  const queue = useGameStore((state) => state.eventQueue);
  const positions = useGameStore((state) => state.visualPositions);
  const advance = useGameStore((state) => state.advanceAnimation);
  const card = useGameStore((state) => state.activeCard);
  const rollSoundFor = useRef<GameEvent | null>(null);

  useEffect(() => {
    if (queue.length === 0 || card) return;
    const event = queue[0];
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const rolling = event.type === 'DICE_ROLLED';
    // The engine rev plays while the die tumbles, not after it lands.
    if (rolling && rollSoundFor.current !== event) {
      rollSoundFor.current = event;
      playEventSound(event);
    }
    const delay = reduced
      ? 0
      : rolling
        ? DICE_ROLL_MS
        : event.type === 'PAWN_MOVED'
          ? 120
          : 320;
    const timer = window.setTimeout(() => {
      if (!rolling) playEventSound(event);
      advance();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [queue, positions, advance, card]);
}
