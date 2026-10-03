import type { TileStrategy } from '../strategy.js';
export const police: TileStrategy = {
  id: 'police',
  index: 15,
  resolve: () => ({ kind: 'move', position: -1 }),
};
