import { FINISHED_POSITION, getLegalMoves } from '@ludo/engine';
import { useGameStore } from '../store';
import { useTranslation } from '../i18n';

export function BonusPanel() {
  const game = useGameStore((state) => state.game);
  const busy = useGameStore((state) => state.eventQueue.length > 0);
  const card = useGameStore((state) => state.activeCard);
  const targeting = useGameStore((state) => state.homeBonusTargeting);
  const useBonus = useGameStore((state) => state.useBonus);
  const cancel = useGameStore((state) => state.cancelHomeBonus);
  const { t, playerName } = useTranslation();
  if (!game?.bonusesEnabled) return null;
  const ready =
    game.phase === 'awaiting_move' && !busy && !card && game.crazyMoves === 0;
  return (
    <section className="bonus-panel" aria-label={t('bonuses')}>
      <div className="bonus-inventories">
        {game.players.map((player, index) => {
          const active = index === game.currentPlayerIndex;
          return (
            <div key={player.id} className={`bonus-inventory ${player.id}`}>
              <span className="sr-only">{playerName(player.id)}</span>
              <button
                type="button"
                aria-label={t('bonusInventory', {
                  player: playerName(player.id),
                  bonus: t('bonusCrazy'),
                  count: player.bonuses.crazy,
                })}
                title={t('bonusCrazyHint')}
                disabled={
                  !ready ||
                  !active ||
                  targeting ||
                  !player.bonuses.crazy ||
                  getLegalMoves({ ...game, crazyMoves: 2 }).length === 0
                }
                onClick={() => useBonus('crazy')}
              >
                <span aria-hidden="true">🤪</span> {player.bonuses.crazy}
              </button>
              <button
                type="button"
                aria-label={t('bonusInventory', {
                  player: playerName(player.id),
                  bonus: t('bonusExtra'),
                  count: player.bonuses.extra_roll,
                })}
                title={t('bonusExtraHint')}
                disabled={
                  !ready ||
                  !active ||
                  targeting ||
                  !player.bonuses.extra_roll ||
                  game.bonusArmed
                }
                onClick={() => useBonus('extra_roll')}
              >
                <span aria-hidden="true">+</span> {player.bonuses.extra_roll}
              </button>
              <button
                type="button"
                aria-label={t('bonusInventory', {
                  player: playerName(player.id),
                  bonus: t('bonusHome'),
                  count: player.bonuses.return_home,
                })}
                title={t('bonusHomeHint')}
                aria-pressed={active && targeting}
                disabled={
                  !ready ||
                  !active ||
                  !player.bonuses.return_home ||
                  !player.pawns.some(
                    (pawn) =>
                      pawn.position >= 0 && pawn.position < FINISHED_POSITION,
                  )
                }
                onClick={() => (targeting ? cancel() : useBonus('return_home'))}
              >
                <span aria-hidden="true">⌂</span> {player.bonuses.return_home}
              </button>
            </div>
          );
        })}
      </div>
      <p className="bonus-hint" role="status">
        {game.crazyMoves > 0
          ? t('bonusCrazyMoves', { count: game.crazyMoves, die: game.die ?? 0 })
          : targeting
            ? t('bonusChooseHome')
            : game.bonusArmed
              ? t('bonusReserved')
              : t('bonusHint')}
      </p>
    </section>
  );
}
