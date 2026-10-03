import { useEffect, useRef, useState } from 'react';
import type { PlayerColor } from '@ludo/engine';
import { useTranslation } from '../i18n';
import { useGameStore } from '../store';

export const REACTIONS = ['😂', '😡', '🔥', '💀', '🇹🇳', '🤬'] as const;

export function ReactionBar() {
  const [bubble, setBubble] = useState<{
    emoji: string;
    player: PlayerColor;
    id: number;
  } | null>(null);
  const id = useRef(0);
  const current = useGameStore((state) => state.displayedPlayerId);
  const { t, playerName } = useTranslation();
  useEffect(() => {
    if (!bubble) return;
    const timer = window.setTimeout(() => setBubble(null), 2000);
    return () => window.clearTimeout(timer);
  }, [bubble]);
  return (
    <section className="reactions" aria-label={t('reaction')}>
      <div className="reaction-bubble" role="status" aria-live="polite">
        {bubble && (
          <span key={bubble.id}>
            {t('reactionBubble', {
              player: playerName(bubble.player),
              emoji: bubble.emoji,
            })}
          </span>
        )}
      </div>
      <div className="reaction-buttons">
        {REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={t('react', { emoji })}
            onClick={() => {
              if (current)
                setBubble({
                  emoji,
                  player: current,
                  id: ++id.current,
                });
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </section>
  );
}
