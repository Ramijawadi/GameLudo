import { advance } from '../helpers.js';
import type { TileStrategy } from '../strategy.js';
export const hkeya: TileStrategy = {
  id: '7keya',
  index: 32,
  resolve: ({ pawn }) => ({
    kind: 'move',
    position: advance(pawn.position, -3),
  }),
};
