export type PlayerColor = 'red' | 'green' | 'yellow' | 'blue';

export interface Pawn {
  readonly id: string;
  /** -1 = yard; 0..50 = relative track; 51..55 = home lane; 56 = finished. */
  readonly position: number;
}

export interface Player {
  readonly id: PlayerColor;
  readonly pawns: readonly Pawn[];
  readonly skipNextTurn: boolean;
}

export interface GameState {
  readonly players: readonly Player[];
  readonly currentPlayerIndex: number;
  readonly phase:
    'awaiting_roll' | 'awaiting_move' | 'CHOOSE_TARGET' | 'finished';
  readonly mode: 'standard' | 'tunisian';
  readonly pendingCard: CardId | null;
  readonly die: number | null;
  readonly consecutiveSixes: number;
  readonly initialSeed: number;
  readonly rngState: number;
  readonly winner: PlayerColor | null;
}

export type Action =
  | { readonly type: 'ROLL_DICE' }
  | { readonly type: 'MOVE_PAWN'; readonly pawnId: string }
  | { readonly type: 'CHOOSE_TARGET'; readonly pawnId: string };

export type TileId =
  | 'cafe'
  | 'taxi'
  | 'impots'
  | 'police'
  | 'baguette'
  | 'maman'
  | 'plage'
  | '7keya'
  | 'biere'
  | 'derby';
export type CardId = 'maman' | '3asba' | 'el-hassel' | 'tchitcha';

export type GameEvent =
  | {
      readonly type: 'DICE_ROLLED';
      readonly playerId: PlayerColor;
      readonly value: number;
    }
  | {
      readonly type: 'PAWN_MOVED';
      readonly playerId: PlayerColor;
      readonly pawnId: string;
      readonly from: number;
      readonly to: number;
    }
  | {
      readonly type: 'PAWN_CAPTURED';
      readonly playerId: PlayerColor;
      readonly pawnId: string;
      readonly capturedBy: string;
    }
  | {
      readonly type: 'PAWN_FINISHED';
      readonly playerId: PlayerColor;
      readonly pawnId: string;
    }
  | {
      readonly type: 'TURN_ENDED';
      readonly playerId: PlayerColor;
      readonly nextPlayerId: PlayerColor;
      readonly reason: 'move' | 'no_moves' | 'three_sixes' | 'skipped';
    }
  | {
      readonly type: 'TILE_TRIGGERED';
      readonly tileId: TileId;
      readonly playerId: PlayerColor;
      readonly pawnId: string;
    }
  | {
      readonly type: 'CARD_DRAWN';
      readonly cardId: CardId;
      readonly playerId: PlayerColor;
    }
  | {
      readonly type: 'CARD_RESOLVED';
      readonly cardId: CardId;
      readonly playerId: PlayerColor;
      readonly pawnId: string | null;
      readonly outcome: 'applied' | 'no_targets' | 'no_effect';
    }
  | { readonly type: 'GAME_WON'; readonly playerId: PlayerColor };

export interface Transition {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

export interface CreateGameOptions {
  readonly seed: number;
  readonly players?: readonly PlayerColor[];
  readonly mode?: 'standard' | 'tunisian';
}

export interface Coordinate {
  readonly x: number;
  readonly y: number;
}

export type BoardTile =
  | { readonly kind: 'track'; readonly index: number }
  | {
      readonly kind: 'home';
      readonly playerId: PlayerColor;
      readonly index: number;
    };
