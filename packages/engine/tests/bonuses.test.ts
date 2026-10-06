import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createGame,
  rollDie,
  type GameState,
  type BonusId,
} from '../src/index.js';

function ready(
  position = 10,
  die = 2,
  inventory: Partial<Record<BonusId, number>> = {},
): GameState {
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
            bonuses: { ...player.bonuses, ...inventory },
            pawns: player.pawns.map((pawn, index) =>
              index ? pawn : { ...pawn, position },
            ),
          },
    ),
  };
}

describe('collectible bonuses', () => {
  it('clears reserved credits on third-six forfeiture and victory', () => {
    const seed = Array.from({ length: 1000 }, (_, index) => index).find(
      (seed) => rollDie(seed).value === 6,
    );
    if (seed === undefined) throw new Error('No six seed');
    const forfeited = applyAction(
      {
        ...ready(4, 2, { extra_roll: 1 }),
        phase: 'awaiting_roll',
        die: null,
        rngState: seed,
        consecutiveSixes: 2,
        extraRolls: 2,
      },
      { type: 'ROLL_DICE' },
    ).state;
    expect(forfeited).toMatchObject({
      currentPlayerIndex: 1,
      extraRolls: 0,
      bonusArmed: false,
      bonusRollPending: false,
    });
    const initial = ready(55, 1, { extra_roll: 1 });
    const finalMove: GameState = {
      ...initial,
      players: initial.players.map((player, index) =>
        index
          ? player
          : {
              ...player,
              pawns: player.pawns.map((pawn, index) =>
                index ? { ...pawn, position: 56 } : pawn,
              ),
            },
      ),
    };
    const reserved = applyAction(finalMove, {
      type: 'USE_BONUS',
      bonusId: 'extra_roll',
    }).state;
    const won = applyAction(reserved, {
      type: 'MOVE_PAWN',
      pawnId: 'red-0',
    }).state;
    expect(won).toMatchObject({
      phase: 'finished',
      extraRolls: 0,
      bonusArmed: false,
      bonusRollPending: false,
    });
  });

  it('replays serialized bonus actions deterministically', () => {
    const initial = ready(10, 2, { extra_roll: 1 });
    const actions = [
      { type: 'USE_BONUS', bonusId: 'extra_roll' },
      { type: 'MOVE_PAWN', pawnId: 'red-0' },
      { type: 'ROLL_DICE' },
      { type: 'MOVE_PAWN', pawnId: 'red-0' },
    ] as const;
    let first = initial;
    let replay: GameState = JSON.parse(JSON.stringify(initial));
    for (const action of actions) {
      const result = applyAction(first, action);
      const repeated = applyAction(replay, action);
      expect(repeated).toEqual(result);
      first = result.state;
      replay = repeated.state;
    }
  });

  it('is opt-in and starts with empty inventories', () => {
    expect(createGame({ seed: 1 }).bonusPickups).toEqual([]);
    const game = createGame({ seed: 1, bonuses: true });
    expect(game.bonusPickups).toHaveLength(6);
    expect(
      game.players.every(
        (player) =>
          player.bonuses.extra_roll === 0 && player.bonuses.return_home === 0,
      ),
    ).toBe(true);
  });

  it('collects only exact landing, consumes the pickup, and does not mutate the input', () => {
    const game = ready();
    const result = applyAction(game, { type: 'MOVE_PAWN', pawnId: 'red-0' });
    expect(result.state.players[0].bonuses.extra_roll).toBe(1);
    expect(
      result.state.bonusPickups.some((pickup) => pickup.index === 12),
    ).toBe(false);
    expect(result.events).toContainEqual({
      type: 'BONUS_COLLECTED',
      playerId: 'red',
      bonusId: 'extra_roll',
    });
    expect(game.players[0].bonuses.extra_roll).toBe(0);
    expect(game.bonusPickups).toHaveLength(6);
    expect(
      applyAction(ready(10, 3), { type: 'MOVE_PAWN', pawnId: 'red-0' }).state
        .players[0].bonuses.extra_roll,
    ).toBe(0);
  });

  it('collects a house and preserves inventory across turn handover', () => {
    const result = applyAction(ready(22), {
      type: 'MOVE_PAWN',
      pawnId: 'red-0',
    });
    expect(result.state.players[0].bonuses.return_home).toBe(1);
    expect(result.state.currentPlayerIndex).toBe(1);
  });

  it('reserves an extra roll, keeps the die, and grants it only after moving', () => {
    const used = applyAction(ready(4, 2, { extra_roll: 1 }), {
      type: 'USE_BONUS',
      bonusId: 'extra_roll',
    });
    expect(used.state).toMatchObject({
      phase: 'awaiting_move',
      die: 2,
      extraRolls: 1,
      bonusArmed: true,
    });
    expect(used.state.players[0].bonuses.extra_roll).toBe(0);
    expect(() => applyAction(used.state, { type: 'ROLL_DICE' })).toThrow();
    const moved = applyAction(used.state, {
      type: 'MOVE_PAWN',
      pawnId: 'red-0',
    });
    expect(moved.state).toMatchObject({
      currentPlayerIndex: 0,
      phase: 'awaiting_roll',
      extraRolls: 0,
      bonusRollPending: true,
    });
    expect(moved.events.some((event) => event.type === 'TURN_ENDED')).toBe(
      false,
    );
    const rolled = applyAction(moved.state, { type: 'ROLL_DICE' });
    expect(rolled.events[0]).toEqual({
      type: 'DICE_ROLLED',
      playerId: 'red',
      value: rollDie(moved.state.rngState).value,
    });
  });

  it('does not replace the natural extra roll on a six', () => {
    const used = applyAction(ready(4, 6, { extra_roll: 1 }), {
      type: 'USE_BONUS',
      bonusId: 'extra_roll',
    }).state;
    const moved = applyAction(used, {
      type: 'MOVE_PAWN',
      pawnId: 'red-0',
    }).state;
    expect(moved.extraRolls).toBe(1);
    const rolled = applyAction(moved, { type: 'ROLL_DICE' }).state;
    const next = applyAction(rolled, {
      type: 'MOVE_PAWN',
      pawnId: 'red-0',
    }).state;
    expect(next).toMatchObject({
      currentPlayerIndex: 0,
      phase: 'awaiting_roll',
      extraRolls: 0,
    });
  });

  it('does not skip an earned bonus roll in Tunisian mode', () => {
    const initial = ready(4, 2, { extra_roll: 1 });
    const game: GameState = {
      ...initial,
      mode: 'tunisian',
      players: initial.players.map((player, index) =>
        index ? player : { ...player, skipNextTurn: true },
      ),
    };
    const used = applyAction(game, {
      type: 'USE_BONUS',
      bonusId: 'extra_roll',
    }).state;
    const moved = applyAction(used, {
      type: 'MOVE_PAWN',
      pawnId: 'red-0',
    }).state;
    expect(applyAction(moved, { type: 'ROLL_DICE' }).events[0].type).toBe(
      'DICE_ROLLED',
    );
  });

  it('returns an own pawn to the yard, without consuming the rolled movement', () => {
    const result = applyAction(ready(4, 6, { return_home: 1 }), {
      type: 'USE_BONUS',
      bonusId: 'return_home',
      pawnId: 'red-0',
    });
    expect(result.state.players[0].pawns[0].position).toBe(-1);
    expect(result.state.players[0].bonuses.return_home).toBe(0);
    expect(result.state).toMatchObject({
      phase: 'awaiting_move',
      die: 6,
      currentPlayerIndex: 0,
    });
    expect(result.events).toContainEqual({
      type: 'PAWN_MOVED',
      playerId: 'red',
      pawnId: 'red-0',
      from: 4,
      to: -1,
    });
  });

  it('rejects missing inventory, repeated reservation, invalid targets, and use outside the move phase', () => {
    expect(() =>
      applyAction(ready(), { type: 'USE_BONUS', bonusId: 'extra_roll' }),
    ).toThrow('You do not have');
    const used = applyAction(ready(4, 2, { extra_roll: 2 }), {
      type: 'USE_BONUS',
      bonusId: 'extra_roll',
    }).state;
    expect(() =>
      applyAction(used, { type: 'USE_BONUS', bonusId: 'extra_roll' }),
    ).toThrow('already reserved');
    for (const pawnId of ['green-0', 'red-1', 'unknown'])
      expect(() =>
        applyAction(ready(4, 2, { return_home: 1 }), {
          type: 'USE_BONUS',
          bonusId: 'return_home',
          pawnId,
        }),
      ).toThrow('unfinished');
    expect(() =>
      applyAction(ready(56, 2, { return_home: 1 }), {
        type: 'USE_BONUS',
        bonusId: 'return_home',
        pawnId: 'red-0',
      }),
    ).toThrow('unfinished');
    expect(() =>
      applyAction(createGame({ seed: 1, bonuses: true }), {
        type: 'USE_BONUS',
        bonusId: 'extra_roll',
      }),
    ).toThrow('after rolling');
  });
});
