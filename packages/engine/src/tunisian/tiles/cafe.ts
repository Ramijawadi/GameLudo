import type { TileStrategy } from '../strategy.js';
export const cafe: TileStrategy = {
  id: 'cafe',
  index: 2,
  resolve: () => ({ kind: 'skip' }),
};
