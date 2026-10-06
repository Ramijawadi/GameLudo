import { useGameStore } from '../store';
import { eventMessage, useTranslation } from '../i18n';

export function TurnBanner() {
  const game = useGameStore((state) => state.game);
  const current = useGameStore((state) => state.displayedPlayerId);
  const busy = useGameStore((state) => state.eventQueue.length > 0);
  const event = useGameStore((state) => state.lastMessageEvent);
  const card = useGameStore((state) => state.activeCard);
  const { t, playerName, language } = useTranslation();
  if (!game || !current) return null;
  const won = game.phase === 'finished' && !busy && !card;
  const instruction =
    busy || card
      ? t('watch')
      : won
        ? t('congratulations')
        : game.phase === 'CHOOSE_TARGET'
          ? t('chooseTarget')
          : game.crazyMoves > 0
            ? t('bonusCrazyMoves', {
                count: game.crazyMoves,
                die: game.die ?? 0,
              })
            : game.phase === 'awaiting_move'
              ? t('chooseMove', { die: game.die ?? 0 })
              : game.consecutiveSixes > 0
                ? t('extraRoll')
                : game.players[game.currentPlayerIndex].skipNextTurn
                  ? t('skippedHint')
                  : t('passPhone');
  return (
    <section
      className={won ? `turn-banner ${current}` : 'sr-only'}
      aria-live="polite"
      aria-atomic="true"
    >
      <h2>
        {won && game.winner
          ? t('win', { player: playerName(game.winner) })
          : t('turn', { player: playerName(current) })}
      </h2>
      <p>{instruction}</p>
      <p className="event-message">
        {event ? eventMessage(language, event) : t('defaultHint')}
      </p>
    </section>
  );
}
