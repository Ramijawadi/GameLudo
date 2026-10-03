import type { TileStrategy } from '../strategy.js';
export const plage: TileStrategy = {
  id: 'plage',
  index: 28,
  resolve: () => ({ kind: 'skip' }),
};
