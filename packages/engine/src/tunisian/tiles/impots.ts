import { advance } from '../helpers.js';
import type { TileStrategy } from '../strategy.js';
export const impots: TileStrategy = {
  id: 'impots',
  index: 10,
  resolve: ({ pawn }) => ({
    kind: 'move',
    position: advance(pawn.position, -2),
  }),
};
