import {
  FINISHED_POSITION,
  HOME_COORDINATES,
  PLAYER_COLORS,
  START_OFFSETS,
  TRACK_COORDINATES,
  isSafeTile,
  tileAt,
  pawnToTile,
  tileToCoordinate,
  type Coordinate,
  type PlayerColor,
} from '@ludo/engine';
import { useGameStore } from '../store';
import { Pawn } from './Pawn';
import { useTranslation } from '../i18n';
import { tileSymbols } from '../tileSymbols';
import { Dice } from './Dice';

const yardOrigins: Record<PlayerColor, Coordinate> = {
  red: { x: 0, y: 0 },
  green: { x: 9, y: 0 },
  yellow: { x: 9, y: 9 },
  blue: { x: 0, y: 9 },
};

function cellStyle(x: number, y: number): { className: string; label: string } {
  const trackIndex = TRACK_COORDINATES.findIndex(
    (tile) => tile.x === x && tile.y === y,
  );
  if (trackIndex !== -1) {
    const start = PLAYER_COLORS.find(
      (color) => START_OFFSETS[color] === trackIndex,
    );
    return {
      className: `track ${start ?? ''} ${isSafeTile(trackIndex) ? 'safe' : ''}`,
      label: isSafeTile(trackIndex) ? '*' : '',
    };
  }
  const home = PLAYER_COLORS.find((color) =>
    HOME_COORDINATES[color].some((tile) => tile.x === x && tile.y === y),
  );
  if (home) return { className: `home ${home}`, label: '' };
  const yard = PLAYER_COLORS.find((color) => {
    const origin = yardOrigins[color];
    return (
      x >= origin.x && x < origin.x + 6 && y >= origin.y && y < origin.y + 6
    );
  });
  return { className: yard ? `yard ${yard}` : 'center', label: '' };
}

const cells = Array.from({ length: 225 }, (_, index) =>
  cellStyle(index % 15, Math.floor(index / 15)),
);

export function Board() {
  const game = useGameStore((state) => state.game);
  const positions = useGameStore((state) => state.visualPositions);
  const legal = useGameStore((state) => state.legalMoves);
  const targets = useGameStore((state) => state.legalTargets);
  const card = useGameStore((state) => state.activeCard);
  const selected = useGameStore((state) => state.selectedPawnId);
  const busy = useGameStore((state) => state.eventQueue.length > 0);
  const select = useGameStore((state) => state.selectPawn);
  const move = useGameStore((state) => state.movePawn);
  const { t } = useTranslation();
  if (!game) return null;

  const pawns = game.players.flatMap((player) =>
    player.pawns.map((pawn, index) => {
      const position = positions[pawn.id];
      const tile = pawnToTile(player.id, position);
      const origin = yardOrigins[player.id];
      const coordinate = tile
        ? tileToCoordinate(tile)
        : {
            x: origin.x + 1.7 + (index % 2) * 2,
            y: origin.y + 1.7 + Math.floor(index / 2) * 2,
          };
      return {
        id: pawn.id,
        playerId: player.id,
        number: index + 1,
        position,
        coordinate,
      };
    }),
  );

  return (
    <div className="board-frame">
      {game.players.map((player) => (
        <Dice key={player.id} playerId={player.id} />
      ))}
      <div className="board" aria-label={t('board')}>
        {cells.map((cell, index) => {
          const trackIndex = TRACK_COORDINATES.findIndex(
            (tile) =>
              tile.x === index % 15 && tile.y === Math.floor(index / 15),
          );
          const special =
            game.mode === 'tunisian' && trackIndex !== -1
              ? tileAt(trackIndex)
              : undefined;
          return (
            <div
              key={index}
              className={`cell ${cell.className} ${special ? 'special-tile' : ''}`}
              title={
                special
                  ? `${t(`tile_${special.id}`)}: ${t(`effect_${special.id}`)}`
                  : undefined
              }
              aria-hidden="true"
            >
              {special ? tileSymbols[special.id] : cell.label}
            </div>
          );
        })}
        {pawns.map((pawn) => {
          const stack = pawns.filter(
            (other) =>
              other.coordinate.x === pawn.coordinate.x &&
              other.coordinate.y === pawn.coordinate.y,
          );
          const index = stack.findIndex((other) => other.id === pawn.id);
          const coordinate =
            stack.length > 1
              ? {
                  x: pawn.coordinate.x + (index % 2 === 0 ? -0.18 : 0.18),
                  y:
                    pawn.coordinate.y +
                    (Math.floor(index / 2) -
                      Math.floor((stack.length - 1) / 2) / 2) *
                      0.24,
                }
              : pawn.coordinate;
          return (
            <Pawn
              key={pawn.id}
              {...pawn}
              coordinate={coordinate}
              playable={
                !busy &&
                !card &&
                (game.phase === 'CHOOSE_TARGET' ? targets : legal).includes(
                  pawn.id,
                )
              }
              selected={selected === pawn.id}
              finished={pawn.position === FINISHED_POSITION}
              onSelect={game.phase === 'CHOOSE_TARGET' ? select : move}
            />
          );
        })}
      </div>
    </div>
  );
}
