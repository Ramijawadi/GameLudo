import { advance } from '../helpers.js';
import type { TileStrategy } from '../strategy.js';
export const derby: TileStrategy = {
  id: 'derby',
  index: 41,
  resolve: ({ pawn }) => ({
    kind: 'move',
    position: advance(pawn.position, 2),
  }),
};
