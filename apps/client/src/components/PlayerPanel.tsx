import { FINISHED_POSITION } from '@ludo/engine';
import { useGameStore } from '../store';
import { useTranslation } from '../i18n';

export function PlayerPanel() {
  const game = useGameStore((state) => state.game);
  const positions = useGameStore((state) => state.visualPositions);
  const current = useGameStore((state) => state.displayedPlayerId);
  const card = useGameStore((state) => state.activeCard);
  const selected = useGameStore((state) => state.selectedPawnId);
  const busy = useGameStore((state) => state.eventQueue.length > 0);
  const chooseTarget = useGameStore((state) => state.chooseSelectedTarget);
  const { t, playerName } = useTranslation();
  if (!game) return null;
  const active = game.players.find((player) => player.id === current);
  if (!active) throw new Error('Missing current player.');
  const targeting = game.phase === 'CHOOSE_TARGET';
  return (
    <>
      <ul className="player-list" aria-label={t('progress')}>
        {game.players.map((player) => (
          <li
            key={player.id}
            className={`player-card ${player.id} ${current === player.id ? 'active' : ''}`}
          >
            <span className="color-dot" />
            <strong>{playerName(player.id)}</strong>
            <span>
              {
                player.pawns.filter(
                  (pawn) => positions[pawn.id] === FINISHED_POSITION,
                ).length
              }
              /4 <span className="sr-only">{t('home')}</span>
            </span>
          </li>
        ))}
      </ul>
      {targeting && (
        <div className={`pawn-picker ${active.id}`}>
          <span className="picker-label sr-only">{t('targetPicker')}</span>
          <button
            className="primary move-button"
            type="button"
            disabled={busy || !!card || !selected}
            onClick={chooseTarget}
          >
            {t('confirmTarget')}
          </button>
        </div>
      )}
    </>
  );
}
