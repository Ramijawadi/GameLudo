import { useGameStore } from '../store';
import { useTranslation } from '../i18n';
import type { PlayerColor } from '@ludo/engine';
import { useRef, type MouseEvent, type PointerEvent } from 'react';

const pips: Record<number, readonly number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const faces = [1, 2, 3, 4, 5, 6] as const;

function useRollControls(playerId?: PlayerColor) {
  const game = useGameStore((state) => state.game);
  const current = useGameStore((state) => state.displayedPlayerId);
  const head = useGameStore((state) => state.eventQueue[0]);
  const busy = useGameStore((state) => state.eventQueue.length > 0);
  const card = useGameStore((state) => state.activeCard);
  const roll = useGameStore((state) => state.roll);
  const suppressTouchClick = useRef(false);
  const canRoll =
    game?.phase === 'awaiting_roll' &&
    !busy &&
    !card &&
    (!playerId || current === playerId);
  const handleRoll = () => {
    roll();
  };
  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    suppressTouchClick.current = false;
    if (event.pointerType !== 'touch' || !canRoll) return;
    suppressTouchClick.current = true;
    handleRoll();
  };
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    // Touch already rolled on contact; ignore its subsequent synthetic click.
    const duplicateTouch = suppressTouchClick.current && event.detail > 0;
    suppressTouchClick.current = false;
    if (!duplicateTouch && canRoll) handleRoll();
  };
  return { game, current, head, busy, canRoll, handlePointerDown, handleClick };
}

export function Dice({ playerId }: { playerId: PlayerColor }) {
  const { game, current, head, busy, canRoll, handlePointerDown, handleClick } =
    useRollControls(playerId);
  const value = useGameStore((state) => state.diceValues[playerId]);
  const rollPlayer = useGameStore((state) => state.lastRollPlayerId);
  const { t, playerName } = useTranslation();
  const rolling = head?.type === 'DICE_ROLLED' && head.playerId === playerId;
  const ready = canRoll && current === playerId;
  const streak =
    !busy && game && current === playerId ? game.consecutiveSixes : 0;
  const motion = rolling
    ? 'spinning'
    : rollPlayer === playerId && value
      ? 'landing'
      : '';
  return (
    <div className={`corner-dice ${playerId} ${ready ? 'ready' : ''}`}>
      <button
        type="button"
        className={`dice-tray ${rolling ? 'rolling' : ''} ${!rolling && value === 6 ? 'six' : ''}`}
        aria-label={`${playerName(playerId)}: ${t('tapDie')}`}
        disabled={!ready}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
      >
        <span className="tray-glow" aria-hidden="true" />
        <span className="die-shadow" aria-hidden="true" />
        <span
          key={rolling ? 'rolling' : `landed-${value ?? 1}`}
          className={`die-bounce ${motion}`}
        >
          <span
            className={`die-cube show-${value ?? 1} ${motion}`}
            role="img"
            aria-label={
              rolling
                ? t('rolling')
                : value
                  ? t('rolled', {
                      player: playerName(playerId),
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
          </span>
        </span>
        {streak > 0 && (
          <span
            className="six-streak"
            aria-label={t('sixStreak', { count: streak })}
          >
            {'🔥'.repeat(streak)}
          </span>
        )}
      </button>
    </div>
  );
}

export function RollButton() {
  const { game, current, head, busy, canRoll, handlePointerDown, handleClick } =
    useRollControls();
  const { t } = useTranslation();
  const color = head?.type === 'DICE_ROLLED' ? head.playerId : (current ?? '');
  return (
    <div className={`dice-stage ${color} ${canRoll ? 'ready' : ''}`}>
      <button
        className="primary roll-button"
        type="button"
        disabled={!canRoll}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
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
