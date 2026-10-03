import type { GameState, Pawn, Player, TileId, CardId } from '../types.js';

export interface EffectContext {
  readonly state: GameState;
  readonly player: Player;
  readonly pawn: Pawn;
}

export type Effect =
  | { readonly kind: 'move'; readonly position: number }
  | { readonly kind: 'skip' }
  | { readonly kind: 'clear_skip' };

export interface TileStrategy {
  readonly id: TileId;
  readonly index: number;
  resolve(context: EffectContext): Effect;
}

export interface CardStrategy {
  readonly id: CardId;
  readonly title: string;
  readonly targeted: boolean;
  targets(state: GameState): readonly string[];
  resolve(context: EffectContext): Effect;
}

export class StrategyRegistry<
  Id extends string,
  Strategy extends { readonly id: Id },
> {
  private readonly strategies: ReadonlyMap<Id, Strategy>;

  constructor(strategies: readonly Strategy[]) {
    const map = new Map<Id, Strategy>();
    for (const strategy of strategies) {
      if (map.has(strategy.id))
        throw new Error(`Duplicate strategy: ${strategy.id}.`);
      map.set(strategy.id, Object.freeze(strategy));
    }
    this.strategies = map;
  }

  get(id: Id): Strategy {
    const strategy = this.strategies.get(id);
    if (!strategy) throw new Error(`Unknown strategy: ${id}.`);
    return strategy;
  }

  all(): readonly Strategy[] {
    return [...this.strategies.values()];
  }
}
