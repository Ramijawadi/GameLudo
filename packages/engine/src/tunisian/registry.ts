import type { CardId, TileId } from '../types.js';
import {
  StrategyRegistry,
  type CardStrategy,
  type TileStrategy,
} from './strategy.js';
import { cafe } from './tiles/cafe.js';
import { taxi } from './tiles/taxi.js';
import { impots } from './tiles/impots.js';
import { police } from './tiles/police.js';
import { baguette } from './tiles/baguette.js';
import { maman } from './tiles/maman.js';
import { plage } from './tiles/plage.js';
import { hkeya } from './tiles/7keya.js';
import { biere } from './tiles/biere.js';
import { derby } from './tiles/derby.js';
import { maman as mamanCard } from './cards/maman.js';
import { asba } from './cards/3asba.js';
import { elHassel } from './cards/el-hassel.js';
import { tchitcha } from './cards/tchitcha.js';

export const tileRegistry = new StrategyRegistry<TileId, TileStrategy>([
  cafe,
  taxi,
  impots,
  police,
  baguette,
  maman,
  plage,
  hkeya,
  biere,
  derby,
]);
export const cardRegistry = new StrategyRegistry<CardId, CardStrategy>([
  mamanCard,
  asba,
  elHassel,
  tchitcha,
]);

export function tileAt(index: number): TileStrategy | undefined {
  return tileRegistry.all().find((tile) => tile.index === index);
}
