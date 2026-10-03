import { useGameStore } from '../store';
import { useTranslation } from '../i18n';

const pips: Record<number, readonly number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function Dice() {
  const game = useGameStore((state) => state.game);
  const value = useGameStore((state) => state.lastDie);
  const rollPlayer = useGameStore((state) => state.lastRollPlayerId);
  const busy = useGameStore((state) => state.eventQueue.length > 0);
  const card = useGameStore((state) => state.activeCard);
  const { t, playerName } = useTranslation();
  const roll = useGameStore((state) => state.roll);
  const canRoll = game?.phase === 'awaiting_roll' && !busy && !card;
  return (
    <div className="dice-controls">
      <div
        className={`die ${rollPlayer ?? ''}`}
        role="img"
        aria-label={
          value
            ? t('rolled', {
                player: rollPlayer ? playerName(rollPlayer) : '',
                value,
              })
            : t('noRoll')
        }
      >
        {Array.from({ length: 9 }, (_, index) => (
          <span
            key={index}
            className={
              value && pips[value].includes(index) ? 'pip visible' : 'pip'
            }
          />
        ))}
      </div>
      <button
        className="primary roll-button"
        type="button"
        disabled={!canRoll}
        onClick={roll}
      >
        {busy
          ? t('playing')
          : game?.phase === 'finished'
            ? t('complete')
            : game?.phase === 'CHOOSE_TARGET'
              ? t('pickTarget')
              : game?.phase === 'awaiting_move'
                ? t('selectBelow')
                : t('roll')}
      </button>
    </div>
  );
}
