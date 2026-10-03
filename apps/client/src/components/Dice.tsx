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

const faces = [1, 2, 3, 4, 5, 6] as const;

export function Dice() {
  const game = useGameStore((state) => state.game);
  const value = useGameStore((state) => state.lastDie);
  const rollPlayer = useGameStore((state) => state.lastRollPlayerId);
  const rollCount = useGameStore((state) => state.rollCount);
  const current = useGameStore((state) => state.displayedPlayerId);
  const head = useGameStore((state) => state.eventQueue[0]);
  const busy = useGameStore((state) => state.eventQueue.length > 0);
  const card = useGameStore((state) => state.activeCard);
  const { t, playerName } = useTranslation();
  const roll = useGameStore((state) => state.roll);
  const rolling = head?.type === 'DICE_ROLLED';
  const canRoll = game?.phase === 'awaiting_roll' && !busy && !card;
  const color = rolling ? head.playerId : (rollPlayer ?? current ?? '');
  const streak = !busy && game ? game.consecutiveSixes : 0;
  const motion = rolling ? 'spinning' : rollCount > 0 ? 'landing' : '';
  return (
    <div className={`dice-stage ${color} ${canRoll ? 'ready' : ''}`}>
      <div
        className={`dice-tray ${rolling ? 'rolling' : ''} ${!rolling && value === 6 ? 'six' : ''}`}
      >
        <span className="tray-glow" aria-hidden="true" />
        <span className="die-shadow" aria-hidden="true" />
        <div
          key={rolling ? 'rolling' : `landed-${rollCount}`}
          className={`die-bounce ${motion}`}
        >
          <div
            className={`die-cube show-${value ?? 1} ${motion}`}
            role="img"
            aria-label={
              rolling
                ? t('rolling')
                : value
                  ? t('rolled', {
                      player: rollPlayer ? playerName(rollPlayer) : '',
                      value,
                    })
                  : t('noRoll')
            }
          >
            {faces.map((face) => (
              <span key={face} className={`die-face face-${face}`}>
                {Array.from({ length: 9 }, (_, index) => (
                  <i
                    key={index}
                    className={
                      pips[face].includes(index) ? 'pip visible' : 'pip'
                    }
                  />
                ))}
              </span>
            ))}
          </div>
        </div>
        {streak > 0 && (
          <span
            className="six-streak"
            aria-label={t('sixStreak', { count: streak })}
          >
            {'🔥'.repeat(streak)}
          </span>
        )}
      </div>
      <button
        className={`primary roll-button ${rolling ? head.playerId : (current ?? '')}`}
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
