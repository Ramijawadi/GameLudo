export function validateSeed(seed: number): void {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('Seed must be an unsigned 32-bit integer.');
  }
}

/** Mulberry32: the returned state, not a hidden mutable generator, drives replay. */
export function nextRandom(state: number): {
  readonly state: number;
  readonly value: number;
} {
  validateSeed(state);
  const nextState = (state + 0x6d2b79f5) >>> 0;
  let value = nextState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return {
    state: nextState,
    value: ((value ^ (value >>> 14)) >>> 0) / 0x100000000,
  };
}

export function rollDie(state: number): {
  readonly state: number;
  readonly value: number;
} {
  const random = nextRandom(state);
  return { state: random.state, value: Math.floor(random.value * 6) + 1 };
}
