import { useEffect } from 'react';
import { useGameStore } from './store';
import { playEventSound } from './sounds';

export function useEventQueue(): void {
  const queue = useGameStore((state) => state.eventQueue);
  const positions = useGameStore((state) => state.visualPositions);
  const advance = useGameStore((state) => state.advanceAnimation);
  const card = useGameStore((state) => state.activeCard);

  useEffect(() => {
    if (queue.length === 0 || card) return;
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const delay = reduced ? 0 : queue[0].type === 'PAWN_MOVED' ? 120 : 320;
    const timer = window.setTimeout(() => {
      playEventSound(queue[0]);
      advance();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [queue, positions, advance, card]);
}
