import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createGame,
  getLegalMoves,
  type GameState,
} from '../src/index.js';

function ready(positions = [8, 10, -1, -1], die = 2): GameState {
  const initial = createGame({ seed: 1, bonuses: true });
  return {
    ...initial,
    phase: 'awaiting_move',
    die,
    players: initial.players.map((player, index) =>
      index
        ? player
        : {
            ...player,
            bonuses: { ...player.bonuses, crazy: 1 },
            pawns: player.pawns.map((pawn, index) => ({
              ...pawn,
              position: positions[index],
            })),
          },
    ),
  };
}

describe('crazy +6 +6 bonus', () => {
  it('is collected on landing and stored rather than triggering immediately', () => {
    const game = ready([2, -1, -1, -1]);
    const result = applyAction(game, { type: 'MOVE_PAWN', pawnId: 'red-0' });
    expect(result.state.players[0].bonuses.crazy).toBe(2);
    expect(result.state.players[0].pawns[0].position).toBe(4);
    expect(result.state.crazyMoves).toBe(0);
    expect(result.state.bonusPickups.some((pickup) => pickup.index === 4)).toBe(
      false,
    );
    expect(result.events).toContainEqual({
      type: 'BONUS_COLLECTED',
      playerId: 'red',
      bonusId: 'crazy',
    });
  });

  it.each([
    ['red-0', 'red-0', 20, 10],
    ['red-0', 'red-1', 14, 16],
  ] as const)(
    'lets %s and %s each move six before playing the original die',
    (first, second, position0, position1) => {
      const game = ready();
      const used = applyAction(game, { type: 'USE_BONUS', bonusId: 'crazy' });
      expect(used.state).toMatchObject({ crazyMoves: 2, die: 2 });
      expect(used.state.players[0].bonuses.crazy).toBe(0);
      expect(game.players[0].bonuses.crazy).toBe(1);
      let state = used.state;
      for (const pawnId of [first, second]) {
        const moved = applyAction(state, { type: 'MOVE_PAWN', pawnId });
        expect(
          moved.events.some(
            (event) =>
              event.type === 'TURN_ENDED' || event.type === 'CARD_DRAWN',
          ),
        ).toBe(false);
        state = moved.state;
      }
      expect(state).toMatchObject({
        crazyMoves: 0,
        die: 2,
        currentPlayerIndex: 0,
        phase: 'awaiting_move',
        consecutiveSixes: 0,
        rngState: game.rngState,
      });
      expect(state.players[0].pawns[0].position).toBe(position0);
      expect(state.players[0].pawns[1].position).toBe(position1);
      const normal = applyAction(state, { type: 'MOVE_PAWN', pawnId: 'red-0' });
      expect(normal.state.players[0].pawns[0].position).toBe(position0 + 2);
      expect(normal.state.currentPlayerIndex).toBe(1);
    },
  );

  it('can leave the yard with a six, then advance six with the same pawn', () => {
    let state = applyAction(ready([-1, -1, -1, -1], 6), {
      type: 'USE_BONUS',
      bonusId: 'crazy',
    }).state;
    state = applyAction(state, { type: 'MOVE_PAWN', pawnId: 'red-0' }).state;
    expect(state.players[0].pawns[0].position).toBe(0);
    state = applyAction(state, { type: 'MOVE_PAWN', pawnId: 'red-0' }).state;
    expect(state.players[0].pawns[0].position).toBe(6);
    expect(state.die).toBe(6);
  });

  it('skips unavailable six moves, then resumes the original die without overshooting finish', () => {
    let state = applyAction(ready([44, 54, 56, 56], 2), {
      type: 'USE_BONUS',
      bonusId: 'crazy',
    }).state;
    state = applyAction(state, { type: 'MOVE_PAWN', pawnId: 'red-0' }).state;
    expect(getLegalMoves(state)).toEqual(['red-0']);
    state = applyAction(state, { type: 'MOVE_PAWN', pawnId: 'red-0' }).state;
    expect(state.players[0].pawns[0].position).toBe(56);
    expect(state).toMatchObject({
      crazyMoves: 0,
      die: 2,
      phase: 'awaiting_move',
    });
    expect(getLegalMoves(state)).toEqual(['red-1']);
    const unavailable = applyAction(ready([50, 54, 56, 56]), {
      type: 'USE_BONUS',
      bonusId: 'crazy',
    }).state;
    const moved = applyAction(unavailable, {
      type: 'MOVE_PAWN',
      pawnId: 'red-0',
    }).state;
    expect(moved).toMatchObject({
      crazyMoves: 0,
      die: 2,
      phase: 'awaiting_move',
    });
  });

  it('rejects nested bonuses, no legal six, empty inventory and rolls during crazy', () => {
    const used = applyAction(ready(), {
      type: 'USE_BONUS',
      bonusId: 'crazy',
    }).state;
    expect(() =>
      applyAction(used, { type: 'USE_BONUS', bonusId: 'crazy' }),
    ).toThrow('Finish the two');
    expect(() => applyAction(used, { type: 'ROLL_DICE' })).toThrow();
    expect(() =>
      applyAction(ready([55, 56, 56, 56], 1), {
        type: 'USE_BONUS',
        bonusId: 'crazy',
      }),
    ).toThrow('No pawn');
    const game = ready();
    expect(() =>
      applyAction(
        {
          ...game,
          players: game.players.map((player) => ({
            ...player,
            bonuses: { ...player.bonuses, crazy: 0 },
          })),
        },
        { type: 'USE_BONUS', bonusId: 'crazy' },
      ),
    ).toThrow('do not have');
  });

  it('ends immediately on victory and clears pending crazy moves', () => {
    const used = applyAction(ready([50, 56, 56, 56]), {
      type: 'USE_BONUS',
      bonusId: 'crazy',
    }).state;
    const won = applyAction(used, { type: 'MOVE_PAWN', pawnId: 'red-0' });
    expect(won.state).toMatchObject({
      phase: 'finished',
      crazyMoves: 0,
      die: null,
      winner: 'red',
    });
  });
});
