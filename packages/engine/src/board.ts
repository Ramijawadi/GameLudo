import type { BoardTile, Coordinate, PlayerColor } from './types.js';

export const PLAYER_COLORS: readonly PlayerColor[] = [
  'red',
  'green',
  'yellow',
  'blue',
];
export const TRACK_LENGTH = 52;
export const HOME_LANE_LENGTH = 6;
export const YARD_POSITION = -1;
export const HOME_ENTRY_POSITION = 51;
export const FINISHED_POSITION = 56;

export const START_OFFSETS: Readonly<Record<PlayerColor, number>> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

export const SAFE_TILES: readonly number[] = [0, 8, 13, 21, 26, 34, 39, 47];

const track: readonly (readonly [number, number])[] = [
  [1, 6],
  [2, 6],
  [3, 6],
  [4, 6],
  [5, 6],
  [6, 5],
  [6, 4],
  [6, 3],
  [6, 2],
  [6, 1],
  [6, 0],
  [7, 0],
  [8, 0],
  [8, 1],
  [8, 2],
  [8, 3],
  [8, 4],
  [8, 5],
  [9, 6],
  [10, 6],
  [11, 6],
  [12, 6],
  [13, 6],
  [14, 6],
  [14, 7],
  [14, 8],
  [13, 8],
  [12, 8],
  [11, 8],
  [10, 8],
  [9, 8],
  [8, 9],
  [8, 10],
  [8, 11],
  [8, 12],
  [8, 13],
  [8, 14],
  [7, 14],
  [6, 14],
  [6, 13],
  [6, 12],
  [6, 11],
  [6, 10],
  [6, 9],
  [5, 8],
  [4, 8],
  [3, 8],
  [2, 8],
  [1, 8],
  [0, 8],
  [0, 7],
  [0, 6],
];

export const TRACK_COORDINATES: readonly Coordinate[] = track.map(([x, y]) => ({
  x,
  y,
}));

export const HOME_COORDINATES: Readonly<
  Record<PlayerColor, readonly Coordinate[]>
> = {
  red: Array.from({ length: HOME_LANE_LENGTH }, (_, index) => ({
    x: index + 1,
    y: 7,
  })),
  green: Array.from({ length: HOME_LANE_LENGTH }, (_, index) => ({
    x: 7,
    y: index + 1,
  })),
  yellow: Array.from({ length: HOME_LANE_LENGTH }, (_, index) => ({
    x: 13 - index,
    y: 7,
  })),
  blue: Array.from({ length: HOME_LANE_LENGTH }, (_, index) => ({
    x: 7,
    y: 13 - index,
  })),
};

export function tileToCoordinate(tile: BoardTile): Coordinate {
  const coordinates =
    tile.kind === 'track' ? TRACK_COORDINATES : HOME_COORDINATES[tile.playerId];
  if (
    !Number.isInteger(tile.index) ||
    tile.index < 0 ||
    tile.index >= coordinates.length
  ) {
    throw new RangeError(`Invalid ${tile.kind} tile index: ${tile.index}.`);
  }
  return { ...coordinates[tile.index] };
}

export function pawnToTile(
  playerId: PlayerColor,
  position: number,
): BoardTile | null {
  if (
    !Number.isInteger(position) ||
    position < YARD_POSITION ||
    position > FINISHED_POSITION
  ) {
    throw new RangeError(`Invalid pawn position: ${position}.`);
  }
  if (position === YARD_POSITION) return null;
  if (position < HOME_ENTRY_POSITION) {
    return {
      kind: 'track',
      index: (START_OFFSETS[playerId] + position) % TRACK_LENGTH,
    };
  }
  return { kind: 'home', playerId, index: position - HOME_ENTRY_POSITION };
}

export function isSafeTile(index: number): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= TRACK_LENGTH) {
    throw new RangeError(`Invalid track tile index: ${index}.`);
  }
  return SAFE_TILES.includes(index);
}
