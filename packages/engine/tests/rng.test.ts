import { describe, expect, it } from 'vitest';
import { nextRandom, rollDie } from '../src/index.js';

describe('seeded RNG', () => {
  it('matches a fixed Mulberry32 sequence', () => {
    const first = nextRandom(1);
    expect(first).toEqual({ state: 1831565814, value: 0.6270739405881613 });
    expect(nextRandom(first.state).value).toBe(0.002735721180215478);
    expect(rollDie(1).value).toBe(4);
  });

  it('is pure and reproducible, including seed zero', () => {
    for (const seed of [0, 1, 42, 0xffffffff]) {
      expect(nextRandom(seed)).toEqual(nextRandom(seed));
      expect(rollDie(seed)).toEqual(rollDie(seed));
    }
    expect(nextRandom(1)).not.toEqual(nextRandom(2));
  });

  it('produces all six integer faces and persists a uint32 state', () => {
    const faces = new Set<number>();
    let state = 0xffffffff;
    for (let index = 0; index < 1000; index++) {
      const random = nextRandom(state);
      expect(random.value).toBeGreaterThanOrEqual(0);
      expect(random.value).toBeLessThan(1);
      const roll = rollDie(state);
      expect(roll.state).toBe(random.state);
      expect(Number.isInteger(roll.state)).toBe(true);
      expect(roll.state).toBeGreaterThanOrEqual(0);
      expect(roll.state).toBeLessThanOrEqual(0xffffffff);
      expect(Number.isInteger(roll.value)).toBe(true);
      expect(roll.value).toBeGreaterThanOrEqual(1);
      expect(roll.value).toBeLessThanOrEqual(6);
      faces.add(roll.value);
      state = roll.state;
    }
    expect([...faces].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it.each([-1, 0x100000000, 0.5, NaN, Infinity])(
    'rejects invalid seed %s',
    (seed) => {
      expect(() => nextRandom(seed)).toThrow(RangeError);
      expect(() => rollDie(seed)).toThrow(RangeError);
    },
  );
});
