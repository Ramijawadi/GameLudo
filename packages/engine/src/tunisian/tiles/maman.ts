import type { TileStrategy } from '../strategy.js';
export const maman: TileStrategy = {
  id: 'maman',
  index: 23,
  resolve: () => ({ kind: 'move', position: -1 }),
};
