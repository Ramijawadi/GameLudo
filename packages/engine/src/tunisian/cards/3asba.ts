import { trackTargets } from '../helpers.js';
import type { CardStrategy } from '../strategy.js';
export const asba: CardStrategy = {
  id: '3asba',
  title: '3asba!',
  targeted: true,
  targets: (state) => trackTargets(state, false),
  resolve: () => ({ kind: 'move', position: -1 }),
};
