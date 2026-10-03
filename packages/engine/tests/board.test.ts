import { describe, expect, it } from 'vitest';
import {
  FINISHED_POSITION,
  HOME_COORDINATES,
  HOME_ENTRY_POSITION,
  HOME_LANE_LENGTH,
  PLAYER_COLORS,
  SAFE_TILES,
  START_OFFSETS,
  TRACK_COORDINATES,
  TRACK_LENGTH,
  isSafeTile,
  pawnToTile,
  tileToCoordinate,
} from '../src/index.js';

describe('board layout', () => {
  it('has a closed, adjacent 52-tile track on a 15x15 grid', () => {
    expect(TRACK_LENGTH).toBe(52);
    expect(TRACK_COORDINATES).toHaveLength(52);
    expect(new Set(TRACK_COORDINATES.map(({ x, y }) => `${x},${y}`)).size).toBe(
      52,
    );
    TRACK_COORDINATES.forEach((coordinate, index) => {
      expect(tileToCoordinate({ kind: 'track', index })).toEqual(coordinate);
      for (const component of [coordinate.x, coordinate.y]) {
        expect(Number.isInteger(component)).toBe(true);
        expect(component).toBeGreaterThanOrEqual(0);
        expect(component).toBeLessThan(15);
      }
      const next = TRACK_COORDINATES[(index + 1) % TRACK_LENGTH];
      expect(
        Math.max(
          Math.abs(next.x - coordinate.x),
          Math.abs(next.y - coordinate.y),
        ),
      ).toBe(1);
    });
  });

  it('has four disjoint six-tile home lanes, including their finish tiles', () => {
    const homeTiles: string[] = [];
    for (const playerId of PLAYER_COLORS) {
      expect(HOME_COORDINATES[playerId]).toHaveLength(HOME_LANE_LENGTH);
      HOME_COORDINATES[playerId].forEach((coordinate, index) => {
        expect(tileToCoordinate({ kind: 'home', playerId, index })).toEqual(
          coordinate,
        );
        expect(coordinate.x).toBeGreaterThanOrEqual(0);
        expect(coordinate.x).toBeLessThan(15);
        expect(coordinate.y).toBeGreaterThanOrEqual(0);
        expect(coordinate.y).toBeLessThan(15);
        expect(TRACK_COORDINATES).not.toContainEqual(coordinate);
        homeTiles.push(`${coordinate.x},${coordinate.y}`);
      });
    }
    expect(new Set(homeTiles).size).toBe(24);
  });

  it('places starts and home lanes with rotational symmetry', () => {
    expect(
      PLAYER_COLORS.map((playerId) =>
        tileToCoordinate({ kind: 'track', index: START_OFFSETS[playerId] }),
      ),
    ).toEqual([
      { x: 1, y: 6 },
      { x: 8, y: 1 },
      { x: 13, y: 8 },
      { x: 6, y: 13 },
    ]);
    for (let index = 0; index < 13; index++) {
      const coordinate = TRACK_COORDINATES[index];
      expect(TRACK_COORDINATES[index + 13]).toEqual({
        x: 14 - coordinate.y,
        y: coordinate.x,
      });
    }
    expect(HOME_COORDINATES.red).toEqual(
      Array.from({ length: 6 }, (_, index) => ({ x: index + 1, y: 7 })),
    );
    expect(HOME_COORDINATES.green[5]).toEqual({ x: 7, y: 6 });
    expect(HOME_COORDINATES.yellow[5]).toEqual({ x: 8, y: 7 });
    expect(HOME_COORDINATES.blue[5]).toEqual({ x: 7, y: 8 });
  });

  it.each(PLAYER_COLORS)(
    'maps every relative pawn position for %s',
    (playerId) => {
      expect(pawnToTile(playerId, -1)).toBeNull();
      for (let position = 0; position < HOME_ENTRY_POSITION; position++) {
        expect(pawnToTile(playerId, position)).toEqual({
          kind: 'track',
          index: (START_OFFSETS[playerId] + position) % TRACK_LENGTH,
        });
      }
      for (
        let position = HOME_ENTRY_POSITION;
        position <= FINISHED_POSITION;
        position++
      ) {
        expect(pawnToTile(playerId, position)).toEqual({
          kind: 'home',
          playerId,
          index: position - HOME_ENTRY_POSITION,
        });
      }
    },
  );

  it('identifies exactly the eight safe tiles', () => {
    expect(SAFE_TILES).toEqual([0, 8, 13, 21, 26, 34, 39, 47]);
    expect(
      Array.from({ length: 52 }, (_, index) => index).filter(isSafeTile),
    ).toEqual(SAFE_TILES);
  });

  it.each([-1, 52, 0.5, NaN])('rejects invalid track tile %s', (index) => {
    expect(() => tileToCoordinate({ kind: 'track', index })).toThrow(
      RangeError,
    );
    expect(() => isSafeTile(index)).toThrow(RangeError);
  });

  it.each([-1, 6, 0.5, NaN])('rejects invalid home tile %s', (index) => {
    expect(() =>
      tileToCoordinate({ kind: 'home', playerId: 'red', index }),
    ).toThrow(RangeError);
  });

  it.each([-2, 57, 0.5, NaN])(
    'rejects invalid pawn position %s',
    (position) => {
      expect(() => pawnToTile('red', position)).toThrow(RangeError);
    },
  );
});
