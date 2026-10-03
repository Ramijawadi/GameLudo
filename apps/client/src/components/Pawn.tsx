import type { Coordinate, PlayerColor } from '@ludo/engine';
import { useTranslation } from '../i18n';

interface PawnProps {
  id: string;
  playerId: PlayerColor;
  number: number;
  coordinate: Coordinate;
  playable: boolean;
  selected: boolean;
  finished: boolean;
  onSelect(id: string): void;
}

export function Pawn({
  id,
  playerId,
  number,
  coordinate,
  playable,
  selected,
  finished,
  onSelect,
}: PawnProps) {
  const { t, playerName } = useTranslation();
  return (
    <button
      type="button"
      className={`pawn ${playerId} ${playable ? 'playable' : ''} ${selected ? 'selected' : ''} ${finished ? 'finished' : ''}`}
      style={{
        left: `${((coordinate.x + 0.5) / 15) * 100}%`,
        top: `${((coordinate.y + 0.5) / 15) * 100}%`,
      }}
      disabled={!playable}
      aria-label={`${t('pawn', { player: playerName(playerId), number })}${finished ? t('finished') : ''}`}
      aria-pressed={selected}
      onClick={() => onSelect(id)}
    >
      {number}
    </button>
  );
}
