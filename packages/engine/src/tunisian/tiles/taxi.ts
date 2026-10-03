import { advance } from '../helpers.js';
import type { TileStrategy } from '../strategy.js';
export const taxi: TileStrategy = {
  id: 'taxi',
  index: 6,
  resolve: ({ pawn }) => ({
    kind: 'move',
    position: advance(pawn.position, 4),
  }),
};
