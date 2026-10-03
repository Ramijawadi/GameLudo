import { FINISHED_POSITION } from '@ludo/engine';
import { useGameStore } from '../store';
import { useTranslation } from '../i18n';

export function PlayerPanel() {
  const game = useGameStore((state) => state.game);
  const positions = useGameStore((state) => state.visualPositions);
  const current = useGameStore((state) => state.displayedPlayerId);
  const legal = useGameStore((state) => state.legalMoves);
  const targets = useGameStore((state) => state.legalTargets);
  const card = useGameStore((state) => state.activeCard);
  const selected = useGameStore((state) => state.selectedPawnId);
  const busy = useGameStore((state) => state.eventQueue.length > 0);
  const select = useGameStore((state) => state.selectPawn);
  const move = useGameStore((state) => state.moveSelected);
  const chooseTarget = useGameStore((state) => state.chooseSelectedTarget);
  const { t, playerName } = useTranslation();
  if (!game) return null;
  const active = game.players.find((player) => player.id === current);
  if (!active) throw new Error('Missing current player.');
  const targeting = game.phase === 'CHOOSE_TARGET';
  const selectablePlayers = targeting
    ? game.players.filter((player) =>
        player.pawns.some((pawn) => targets.includes(pawn.id)),
      )
    : [active];
  const playable = targeting ? targets : legal;
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
      {game.phase !== 'finished' && (
        <div className={`pawn-picker ${active.id}`}>
          <span className="picker-label sr-only">
            {t(targeting ? 'targetPicker' : 'picker')}
          </span>
          <div className="pawn-groups">
            {selectablePlayers.map((player) => (
              <div
                key={player.id}
                className="pawn-choices"
                role="group"
                aria-label={t('selection', { player: playerName(player.id) })}
              >
                {player.pawns.map((pawn, index) => (
                  <button
                    key={pawn.id}
                    type="button"
                    aria-label={t('selectPawn', {
                      player: playerName(player.id),
                      number: index + 1,
                    })}
                    aria-pressed={selected === pawn.id}
                    disabled={busy || !!card || !playable.includes(pawn.id)}
                    className={`pawn-choice ${player.id} ${playable.includes(pawn.id) && !busy && !card ? 'playable' : ''}`}
                    onClick={() => select(pawn.id)}
                  >
                    <span className="pawn-number">{index + 1}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
          <button
            className="primary move-button"
            type="button"
            disabled={busy || !!card || !selected}
            onClick={targeting ? chooseTarget : move}
          >
            {targeting
              ? t('confirmTarget')
              : selected
                ? t('movePawn', {
                    number:
                      active.pawns.findIndex((pawn) => pawn.id === selected) +
                      1,
                  })
                : t('selectMove')}
          </button>
        </div>
      )}
    </>
  );
}
