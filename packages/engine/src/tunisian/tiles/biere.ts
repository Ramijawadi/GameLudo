import { advance } from '../helpers.js';
import type { TileStrategy } from '../strategy.js';
export const biere: TileStrategy = {
  id: 'biere',
  index: 36,
  resolve: ({ pawn }) => ({
    kind: 'move',
    position: advance(pawn.position, -1),
  }),
};
