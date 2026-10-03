import {
  FINISHED_POSITION,
  HOME_ENTRY_POSITION,
  isSafeTile,
  pawnToTile,
} from '../board.js';
import type { GameState } from '../types.js';

export const advance = (position: number, steps: number): number =>
  Math.max(0, Math.min(FINISHED_POSITION, position + steps));

export function trackTargets(
  state: GameState,
  own: boolean,
): readonly string[] {
  const current = state.players[state.currentPlayerIndex].id;
  return state.players.flatMap((player) =>
    (player.id === current) === own
      ? player.pawns
          .filter((pawn) => {
            if (pawn.position < 0 || pawn.position >= HOME_ENTRY_POSITION)
              return false;
            const tile = pawnToTile(player.id, pawn.position);
            return own || (tile?.kind === 'track' && !isSafeTile(tile.index));
          })
          .map((pawn) => pawn.id)
      : [],
  );
}
