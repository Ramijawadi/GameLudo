import { advance, trackTargets } from '../helpers.js';
import type { CardStrategy } from '../strategy.js';
export const elHassel: CardStrategy = {
  id: 'el-hassel',
  title: 'El 7assel',
  targeted: true,
  targets: (state) => trackTargets(state, false),
  resolve: ({ pawn }) => ({
    kind: 'move',
    position: advance(pawn.position, -3),
  }),
};
