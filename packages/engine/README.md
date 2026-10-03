# Ludo engine

Framework-independent, immutable TypeScript engine. Standard rules are the default;
the Tunisian layer is opt-in with `mode: 'tunisian'`.

## API

```ts
import { applyAction, createGame, getLegalMoves } from '@ludo/engine';

let state = createGame({ seed: 1, players: ['red', 'blue'] });
let result = applyAction(state, { type: 'ROLL_DICE' });
state = result.state;

const moves = getLegalMoves(state);
if (moves.length > 0) {
  result = applyAction(state, { type: 'MOVE_PAWN', pawnId: moves[0] });
  state = result.state;
}
```

- `createGame({ seed, players?, mode? })`: unsigned 32-bit seed (including zero), two
  to four distinct colors in turn order. Defaults to red, green, yellow, blue.
- `applyAction(state, action)`: returns `{ state, events }` without mutating its
  input. Illegal actions throw. Pawn IDs are `<color>-<index>` with indices 0..3.
- `getLegalMoves(state)`: legal pawn IDs for the current rolled die, or an empty
  list outside the move phase.
- `getLegalTargets(state)`: eligible pawn IDs in `CHOOSE_TARGET`.
  Resolve a targeted card with `{ type: 'CHOOSE_TARGET', pawnId }`.
- `nextRandom(state)` / `rollDie(state)`: pure Mulberry32 RNG steps with explicit
  next state. Moving pawns does not consume randomness.
- `pawnToTile(color, position)` / `tileToCoordinate(tile)`: logical positions to
  board tiles and `{ x, y }` coordinates. Yard positions have no board tile.

## Standard rules

- Four pawns per player. A six leaves the yard onto the start tile; it does not
  advance six more steps.
- A pawn moves 51 shared-track positions, then enters its own home lane. Finishing
  requires an exact roll.
- Landing on opponents on an unsafe tile captures all of them to their yards.
  Friendly stacking and passing occupied tiles are allowed; there are no blockades.
- The eight safe global track indices are 0, 8, 13, 21, 26, 34, 39, 47. Any player
  is protected there. Home lanes are private and cannot be captured.
- Only a six grants another roll (even if no move is possible). The third
  consecutive six forfeits the turn without a move; earlier moves are retained.
  A non-six clears the streak. No legal move automatically passes the turn,
  except on a six.
- Captures and finishing a pawn do not themselves grant extra turns.
- Finishing all four pawns wins immediately, including on a six.

## Positions and board coordinates

The 15x15 grid uses integer coordinates 0..14, with x increasing right and y
increasing down. The 52 shared tiles are in clockwise travel order. Red starts
at (1, 6), green at (8, 1), yellow at (13, 8), and blue at (6, 13).

Pawn positions are relative to their owner's start:

| Position | Meaning                                       |
| -------- | --------------------------------------------- |
| -1       | Yard                                          |
| 0..50    | Shared track, `(startOffset + position) % 52` |
| 51..55   | First five home lane tiles                    |
| 56       | Sixth home lane tile, finished                |

Each player's home lane has six tiles, including its finish tile at the edge
of the central 3x3 square. Track index 51 relative to a player's start is bypassed
when that player turns into its home lane.

## Tunisian layer

Each tile and card has its own file implementing `TileStrategy` or `CardStrategy`.
`StrategyRegistry` rejects duplicate IDs and exposes registered strategies through
`tileRegistry` and `cardRegistry`. State transitions apply their effects centrally
so capture, movement events, and turn flow remain consistent.

Special tiles are fixed global track indices, all outside the eight safe tiles:

| Tile     | Index | Landing effect |
| -------- | ----- | -------------- |
| cafe     | 2     | Skip next turn |
| taxi     | 6     | Forward 4      |
| impots   | 10    | Backward 2     |
| police   | 15    | Return to yard |
| baguette | 19    | Forward 1      |
| maman    | 23    | Return to yard |
| plage    | 28    | Skip next turn |
| 7keya    | 32    | Backward 3     |
| biere    | 36    | Backward 1     |
| derby    | 41    | Forward 2      |

Effects trigger on landing only. They do not chain into another special tile.
Normal captures occur at the initial landing and effect destination. Movement
uses the owner's relative route: backward movement stops at start, forward
movement stops at finish. Skipped turns do not consume randomness. A skip is
one pending penalty, not an accumulating counter, and does not cancel extra
rolls within the current turn.

The second consecutive six draws one card before the pending pawn move.
Cards are drawn uniformly **with replacement**, consuming one extra seeded RNG
step. The third consecutive six still forfeits the turn without a draw.

| ID        | Card              | Effect                                                         |
| --------- | ----------------- | -------------------------------------------------------------- |
| maman     | Ta mère t'appelle | Choose own track pawn; return it to yard                       |
| 3asba     | 3asba!            | Choose unsafe opponent track pawn; return it to yard           |
| el-hassel | El 7assel         | Choose unsafe opponent track pawn; retreat 3, clamped at start |
| tchitcha  | Tchitcha          | Clear own pending skipped turn; otherwise no effect            |

The first three cards enter `CHOOSE_TARGET` when eligible targets exist.
No eligible targets produces an explicit `CARD_RESOLVED` event with `no_targets`.
Home-lane and finished pawns cannot be targeted; opponents on safe tiles are
protected. Card movement neither captures nor triggers special tiles.
After resolution, the pending six is retained and legal moves are recomputed.
If there are none, the normal six extra-roll rule applies.

New events: `TILE_TRIGGERED`, `CARD_DRAWN`, `CARD_RESOLVED`, and `TURN_ENDED` with
reason `skipped`. Penalties and `pendingCard` are serialized in game state.

## Replay

Store the original seed, mode, player order, and ordered actions. Starting with
`createGame` and applying those same actions reproduces every state and event.
States and actions are JSON-serializable; persisted RNG state also allows exact
resumption mid-game. Changing rules or RNG requires replay versioning.

The engine is a trusted-state rules layer: callers must authorize the acting
player and validate externally loaded state before invoking it.

Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` from the root.
