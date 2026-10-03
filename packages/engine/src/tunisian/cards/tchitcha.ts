import type { CardStrategy } from '../strategy.js';
export const tchitcha: CardStrategy = {
  id: 'tchitcha',
  title: 'Tchitcha',
  targeted: false,
  targets: () => [],
  resolve: () => ({ kind: 'clear_skip' }),
};
