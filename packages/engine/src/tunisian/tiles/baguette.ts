import { advance } from '../helpers.js';
import type { TileStrategy } from '../strategy.js';
export const baguette: TileStrategy = {
  id: 'baguette',
  index: 19,
  resolve: ({ pawn }) => ({
    kind: 'move',
    position: advance(pawn.position, 1),
  }),
};
