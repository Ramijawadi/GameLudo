import { trackTargets } from '../helpers.js';
import type { CardStrategy } from '../strategy.js';
export const maman: CardStrategy = {
  id: 'maman',
  title: "Ta mère t'appelle",
  targeted: true,
  targets: (state) => trackTargets(state, true),
  resolve: () => ({ kind: 'move', position: -1 }),
};
