import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createGame,
  getLegalMoves,
  PLAYER_COLORS,
  rollDie,
  SAFE_TILES,
  START_OFFSETS,
  type Action,
  type GameEvent,
  type GameState,
  type PlayerColor,
} from '../src/index.js';

function seedFor(faces: readonly number[]): number {
  for (let seed = 0; seed < 100000; seed++) {
    let state = seed;
    if (
      faces.every((face) => {
        const roll = rollDie(state);
        state = roll.state;
        return roll.value === face;
      })
    )
      return seed;
  }
  throw new Error(`Cannot find a seed for ${faces.join(',')}.`);
}

function positions(
  state: GameState,
  playerId: PlayerColor,
  values: readonly number[],
): GameState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id !== playerId
        ? player
        : {
            ...player,
            pawns: player.pawns.map((pawn, index) => ({
              ...pawn,
              position: values[index] ?? pawn.position,
            })),
          },
    ),
  };
}

function ready(
  die: number,
  values: readonly number[],
  playerId: PlayerColor = 'red',
): GameState {
  const state = positions(createGame({ seed: 1 }), playerId, values);
  return {
    ...state,
    phase: 'awaiting_move',
    die,
    currentPlayerIndex: PLAYER_COLORS.indexOf(playerId),
  };
}

function move(state: GameState, pawnId = 'red-0') {
  return applyAction(state, { type: 'MOVE_PAWN', pawnId });
}

function freeze(value: unknown): void {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
}

describe('createGame', () => {
  it('initializes four players with four uniquely identified yard pawns each', () => {
    const state = createGame({ seed: 42 });
    expect(state).toMatchObject({
      initialSeed: 42,
      rngState: 42,
      phase: 'awaiting_roll',
      die: null,
      consecutiveSixes: 0,
      currentPlayerIndex: 0,
      winner: null,
    });
    expect(state.players.map((player) => player.id)).toEqual(PLAYER_COLORS);
    expect(state.players.every((player) => player.pawns.length === 4)).toBe(
      true,
    );
    expect(
      state.players
        .flatMap((player) => player.pawns)
        .every((pawn) => pawn.position === -1),
    ).toBe(true);
    expect(
      new Set(
        state.players.flatMap((player) => player.pawns.map((pawn) => pawn.id)),
      ).size,
    ).toBe(16);
    expect(createGame({ seed: 42 })).toEqual(state);
  });

  it.each([
    ['blue', 'red'],
    ['yellow', 'blue', 'green'],
  ] satisfies PlayerColor[][])(
    'preserves supplied player order %j',
    (...players) => {
      expect(
        createGame({ seed: 0, players }).players.map((player) => player.id),
      ).toEqual(players);
    },
  );

  it('does not alias the caller player list or other games', () => {
    const players: PlayerColor[] = ['red', 'blue'];
    const game = createGame({ seed: 0, players });
    players.reverse();
    expect(game.players.map((player) => player.id)).toEqual(['red', 'blue']);
    expect(game.players).not.toBe(
      createGame({ seed: 0, players: ['red', 'blue'] }).players,
    );
  });

  it.each([[], ['red'], ['red', 'red']] satisfies PlayerColor[][])(
    'rejects invalid players %j',
    (...players) => {
      expect(() => createGame({ seed: 1, players })).toThrow(RangeError);
    },
  );

  it.each([-1, 0.5, 0x100000000, NaN])('rejects invalid seed %s', (seed) => {
    expect(() => createGame({ seed })).toThrow(RangeError);
  });
});

describe('dice and turn flow', () => {
  it.each([1, 2, 3, 4, 5])(
    'automatically passes a roll of %s when all pawns are in the yard',
    (face) => {
      const state = createGame({ seed: seedFor([face]) });
      const result = applyAction(state, { type: 'ROLL_DICE' });
      expect(result.state).toMatchObject({
        currentPlayerIndex: 1,
        phase: 'awaiting_roll',
        die: null,
        consecutiveSixes: 0,
        rngState: rollDie(state.rngState).state,
      });
      expect(result.events).toEqual([
        { type: 'DICE_ROLLED', playerId: 'red', value: face },
        {
          type: 'TURN_ENDED',
          playerId: 'red',
          nextPlayerId: 'green',
          reason: 'no_moves',
        },
      ]);
      expect(result.state.players).toEqual(state.players);
    },
  );

  it('waits for a move on a six and grants another roll after leaving the yard', () => {
    const state = createGame({ seed: seedFor([6]) });
    const rolled = applyAction(state, { type: 'ROLL_DICE' });
    expect(rolled.state).toMatchObject({
      phase: 'awaiting_move',
      die: 6,
      consecutiveSixes: 1,
    });
    expect(getLegalMoves(rolled.state)).toEqual([
      'red-0',
      'red-1',
      'red-2',
      'red-3',
    ]);
    const moved = move(rolled.state);
    expect(moved.state).toMatchObject({
      currentPlayerIndex: 0,
      phase: 'awaiting_roll',
      die: null,
      consecutiveSixes: 1,
    });
    expect(moved.state.players[0].pawns[0].position).toBe(0);
    expect(moved.events).toEqual([
      { type: 'PAWN_MOVED', playerId: 'red', pawnId: 'red-0', from: -1, to: 0 },
    ]);
    expect(moved.state.rngState).toBe(rolled.state.rngState);
  });

  it('forfeits the third six without moving or undoing previous moves', () => {
    let state = createGame({ seed: seedFor([6, 6, 6]) });
    state = move(applyAction(state, { type: 'ROLL_DICE' }).state).state;
    state = move(applyAction(state, { type: 'ROLL_DICE' }).state).state;
    expect(state.players[0].pawns[0].position).toBe(6);
    const result = applyAction(state, { type: 'ROLL_DICE' });
    expect(result.state).toMatchObject({
      currentPlayerIndex: 1,
      phase: 'awaiting_roll',
      die: null,
      consecutiveSixes: 0,
    });
    expect(result.state.players).toEqual(state.players);
    expect(result.events).toEqual([
      { type: 'DICE_ROLLED', playerId: 'red', value: 6 },
      {
        type: 'TURN_ENDED',
        playerId: 'red',
        nextPlayerId: 'green',
        reason: 'three_sixes',
      },
    ]);
  });

  it('retains the extra roll on an unplayable six, but still forfeits the third six', () => {
    let state = positions(
      createGame({ seed: seedFor([6, 6, 6]) }),
      'red',
      [55, 56, 56, 56],
    );
    for (let index = 1; index <= 2; index++) {
      const result = applyAction(state, { type: 'ROLL_DICE' });
      expect(result.events).toHaveLength(1);
      expect(result.state).toMatchObject({
        phase: 'awaiting_roll',
        currentPlayerIndex: 0,
        die: null,
        consecutiveSixes: index,
      });
      state = result.state;
    }
    expect(applyAction(state, { type: 'ROLL_DICE' }).events[1]).toMatchObject({
      reason: 'three_sixes',
    });
  });

  it('resets the six streak on a non-six and passes after the move', () => {
    let state = createGame({ seed: seedFor([6, 6, 2]) });
    state = move(applyAction(state, { type: 'ROLL_DICE' }).state).state;
    state = move(applyAction(state, { type: 'ROLL_DICE' }).state).state;
    const rolled = applyAction(state, { type: 'ROLL_DICE' });
    expect(rolled.state.consecutiveSixes).toBe(0);
    expect(move(rolled.state).state).toMatchObject({
      currentPlayerIndex: 1,
      consecutiveSixes: 0,
      die: null,
    });
  });

  it('passes an unplayable non-six near the finish', () => {
    const state = positions(
      createGame({ seed: seedFor([2]) }),
      'red',
      [55, 56, 56, 56],
    );
    expect(applyAction(state, { type: 'ROLL_DICE' }).events[1]).toMatchObject({
      reason: 'no_moves',
    });
  });

  it('wraps the turn to the first player for a custom two-player game', () => {
    const initial = createGame({
      seed: seedFor([1]),
      players: ['blue', 'red'],
    });
    const state = { ...initial, currentPlayerIndex: 1 };
    const result = applyAction(state, { type: 'ROLL_DICE' });
    expect(result.state.currentPlayerIndex).toBe(0);
    expect(result.events[1]).toMatchObject({
      playerId: 'red',
      nextPlayerId: 'blue',
    });
  });
});

describe('legal moves and action validation', () => {
  it.each(PLAYER_COLORS)(
    'checks every position and dice face for %s',
    (playerId) => {
      for (let position = -1; position <= 56; position++) {
        for (let die = 1; die <= 6; die++) {
          const state = ready(die, [position, 56, 56, 56], playerId);
          const legal =
            position === -1 ? die === 6 : position < 56 && position + die <= 56;
          expect(getLegalMoves(state)).toEqual(legal ? [`${playerId}-0`] : []);
          if (legal) {
            const result = move(state, `${playerId}-0`);
            expect(
              result.state.players[state.currentPlayerIndex].pawns[0].position,
            ).toBe(position === -1 ? 0 : position + die);
          } else {
            expect(() => move(state, `${playerId}-0`)).toThrow(
              'Illegal pawn move',
            );
          }
        }
      }
    },
  );

  it.each([1, 2, 3, 4, 5])(
    'requires six to enter and permits track movement on %s',
    (die) => {
      expect(getLegalMoves(ready(die, [-1, 0, 56, 55]))).toEqual(
        die === 1 ? ['red-1', 'red-3'] : ['red-1'],
      );
    },
  );

  it('includes yard pawns on six, excludes finished pawns and overshoots', () => {
    expect(getLegalMoves(ready(6, [-1, 50, 51, 56]))).toEqual([
      'red-0',
      'red-1',
    ]);
  });

  it('returns no legal moves outside the move phase', () => {
    expect(getLegalMoves(createGame({ seed: 0 }))).toEqual([]);
    expect(getLegalMoves({ ...ready(1, [0]), phase: 'finished' })).toEqual([]);
    expect(getLegalMoves({ ...ready(1, [0]), die: null })).toEqual([]);
  });

  it('rejects rolling twice, moving before rolling, another player pawn and unknown pawns', () => {
    expect(() => applyAction(ready(6, [-1]), { type: 'ROLL_DICE' })).toThrow(
      'Move a pawn',
    );
    expect(() => move(createGame({ seed: 0 }))).toThrow('Roll before');
    expect(() => move(ready(6, [-1]), 'green-0')).toThrow('Illegal pawn move');
    expect(() => move(ready(6, [-1]), 'unknown')).toThrow('Illegal pawn move');
    expect(() => move(ready(2, [55]))).toThrow('Illegal pawn move');
    expect(() => move(ready(1, [-1]))).toThrow('Illegal pawn move');
    expect(() => move(ready(1, [56]))).toThrow('Illegal pawn move');
  });

  it('does not mutate state during actions or rejected actions', () => {
    const initial = createGame({ seed: seedFor([6]) });
    const snapshot = structuredClone(initial);
    freeze(initial);
    const rolled = applyAction(initial, { type: 'ROLL_DICE' }).state;
    expect(initial).toEqual(snapshot);
    freeze(rolled);
    const result = move(rolled);
    expect(result.state).not.toBe(rolled);
    expect(rolled.players[0].pawns[0].position).toBe(-1);
    expect(() => move(rolled, 'unknown')).toThrow();
    expect(rolled.players[0].pawns[0].position).toBe(-1);
  });
});

describe('movement and capture', () => {
  it.each(PLAYER_COLORS)(
    'moves %s into its home lane instead of circling again',
    (playerId) => {
      const result = move(ready(1, [50], playerId), `${playerId}-0`);
      expect(
        result.state.players[PLAYER_COLORS.indexOf(playerId)].pawns[0].position,
      ).toBe(51);
    },
  );

  it.each([1, 2, 3, 4, 5, 6])('moves exactly %s steps on the track', (die) => {
    expect(move(ready(die, [10])).state.players[0].pawns[0].position).toBe(
      10 + die,
    );
  });

  it('captures an opponent on a shared global track tile across the track wrap', () => {
    const state = positions(ready(1, [2], 'blue'), 'red', [42]);
    const result = move(state, 'blue-0');
    expect(result.state.players[0].pawns[0].position).toBe(-1);
    expect(result.events).toContainEqual({
      type: 'PAWN_CAPTURED',
      playerId: 'red',
      pawnId: 'red-0',
      capturedBy: 'blue-0',
    });
    expect(result.events.at(-1)).toMatchObject({
      type: 'TURN_ENDED',
      nextPlayerId: 'red',
    });
  });

  it('captures all opponents on a non-safe destination, with no blockade or extra turn', () => {
    let state = positions(ready(2, [12]), 'green', [1, 1]);
    state = positions(state, 'blue', [27]);
    const result = move(state);
    expect(
      result.state.players[1].pawns.slice(0, 2).map((pawn) => pawn.position),
    ).toEqual([-1, -1]);
    expect(result.state.players[3].pawns[0].position).toBe(-1);
    expect(
      result.events.filter((event) => event.type === 'PAWN_CAPTURED'),
    ).toHaveLength(3);
    expect(result.state.currentPlayerIndex).toBe(1);
  });

  it.each(SAFE_TILES)(
    'does not capture on safe track tile %s',
    (destination) => {
      const moverId = destination === 0 ? 'blue' : 'red';
      const opponentId = destination === 0 ? 'red' : 'blue';
      const moverPosition = (destination - START_OFFSETS[moverId] + 52) % 52;
      const opponentPosition =
        (destination - START_OFFSETS[opponentId] + 52) % 52;
      const state = positions(
        ready(1, [moverPosition - 1], moverId),
        opponentId,
        [opponentPosition],
      );
      const result = move(state, `${moverId}-0`);
      expect(
        result.state.players.find((player) => player.id === opponentId)
          ?.pawns[0].position,
      ).toBe(opponentPosition);
      expect(
        result.events.some((event) => event.type === 'PAWN_CAPTURED'),
      ).toBe(false);
    },
  );

  it('allows friendly stacking and crossing occupied tiles without capture', () => {
    const state = positions(ready(3, [12, 15]), 'green', [1, 1]);
    const result = move(state);
    expect(
      result.state.players[0].pawns.slice(0, 2).map((pawn) => pawn.position),
    ).toEqual([15, 15]);
    expect(
      result.state.players[1].pawns.slice(0, 2).map((pawn) => pawn.position),
    ).toEqual([1, 1]);
    expect(result.events.some((event) => event.type === 'PAWN_CAPTURED')).toBe(
      false,
    );
  });

  it('never captures pawns in another home lane or at the finish', () => {
    let state = positions(ready(2, [51]), 'green', [53, 56]);
    state = positions(state, 'blue', [53]);
    const result = move(state);
    expect(
      result.state.players[1].pawns.slice(0, 2).map((pawn) => pawn.position),
    ).toEqual([53, 56]);
    expect(result.state.players[3].pawns[0].position).toBe(53);
    expect(result.events.some((event) => event.type === 'PAWN_CAPTURED')).toBe(
      false,
    );
  });

  it('does not capture a track pawn when entering the home lane', () => {
    const result = move(positions(ready(1, [50]), 'green', [38]));
    expect(result.state.players[1].pawns[0].position).toBe(38);
    expect(result.events.some((event) => event.type === 'PAWN_CAPTURED')).toBe(
      false,
    );
  });

  it('grants an extra roll when a capture happens on six', () => {
    const result = move(positions(ready(6, [9]), 'green', [2]));
    expect(result.events.some((event) => event.type === 'PAWN_CAPTURED')).toBe(
      true,
    );
    expect(result.state.currentPlayerIndex).toBe(0);
  });
});

describe('finishing and victory', () => {
  it.each([1, 2, 3, 4, 5, 6])('finishes with an exact roll of %s', (die) => {
    const result = move(ready(die, [56 - die]));
    expect(result.state.players[0].pawns[0].position).toBe(56);
    expect(result.events).toContainEqual({
      type: 'PAWN_FINISHED',
      playerId: 'red',
      pawnId: 'red-0',
    });
    expect(result.state.winner).toBeNull();
    expect(result.state.currentPlayerIndex).toBe(die === 6 ? 0 : 1);
  });

  it('wins only when all four pawns finish and rejects all subsequent actions', () => {
    const result = move(ready(1, [55, 56, 56, 56]));
    expect(result.state).toMatchObject({
      phase: 'finished',
      winner: 'red',
      die: null,
      consecutiveSixes: 0,
    });
    expect(result.events.map((event) => event.type)).toEqual([
      'PAWN_MOVED',
      'PAWN_FINISHED',
      'GAME_WON',
    ]);
    expect(getLegalMoves(result.state)).toEqual([]);
    expect(() => applyAction(result.state, { type: 'ROLL_DICE' })).toThrow(
      'already finished',
    );
    expect(() => move(result.state)).toThrow('already finished');
  });

  it('ends the game rather than granting another roll on a winning six', () => {
    const result = move(ready(6, [50, 56, 56, 56]));
    expect(result.state).toMatchObject({ phase: 'finished', winner: 'red' });
    expect(result.events.at(-1)).toEqual({ type: 'GAME_WON', playerId: 'red' });
  });
});

describe('deterministic replay', () => {
  it.each([
    { seed: 12345, players: ['red', 'green', 'yellow', 'blue'] },
    { seed: 0, players: ['blue', 'red'] },
    { seed: 0xffffffff, players: ['yellow', 'blue', 'green'] },
  ] satisfies Parameters<typeof createGame>[0][])(
    'replays a complete game with seed $seed and players $players',
    (options) => {
      const actions: Action[] = [];
      const snapshots: GameState[] = [];
      const eventLog: (readonly GameEvent[])[] = [];
      let state = createGame(options);
      for (
        let count = 0;
        state.phase !== 'finished' && count < 10000;
        count++
      ) {
        const legal = getLegalMoves(state);
        const action: Action =
          state.phase === 'awaiting_roll'
            ? { type: 'ROLL_DICE' }
            : { type: 'MOVE_PAWN', pawnId: legal[0] };
        const result = applyAction(state, action);
        actions.push(action);
        snapshots.push(result.state);
        eventLog.push(result.events);
        state = result.state;
      }
      expect(state.phase).toBe('finished');
      expect(state.winner).not.toBeNull();
      expect(
        eventLog.flat().filter((event) => event.type === 'GAME_WON'),
      ).toHaveLength(1);
      let replay = createGame(options);
      actions.forEach((action, index) => {
        const result = applyAction(replay, action);
        expect(result.state).toEqual(snapshots[index]);
        expect(result.events).toEqual(eventLog[index]);
        replay = result.state;
      });
      expect(replay).toEqual(state);
    },
  );

  it('resumes identically from a JSON-serialized state including RNG and six streak', () => {
    const initial = createGame({ seed: seedFor([6, 6, 6]) });
    const state = move(applyAction(initial, { type: 'ROLL_DICE' }).state).state;
    const restored: GameState = JSON.parse(JSON.stringify(state));
    expect(applyAction(restored, { type: 'ROLL_DICE' })).toEqual(
      applyAction(state, { type: 'ROLL_DICE' }),
    );
  });
});
