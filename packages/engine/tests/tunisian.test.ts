import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createGame,
  getLegalMoves,
  getLegalTargets,
  nextRandom,
  rollDie,
  cardRegistry,
  tileRegistry,
  StrategyRegistry,
  SAFE_TILES,
  type Action,
  type CardId,
  type GameState,
  type PlayerColor,
} from '../src/index.js';

function position(
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

function moveAt(
  index: number,
  playerId: PlayerColor = 'red',
  other?: GameState,
) {
  const offset = { red: 0, green: 13, yellow: 26, blue: 39 }[playerId];
  const relative = (index - offset + 52) % 52;
  if (relative === 0 || relative === 51)
    throw new Error('Test landing must be reachable with one step');
  let state = position(
    other ?? createGame({ seed: 1, mode: 'tunisian' }),
    playerId,
    [relative - 1],
  );
  state = {
    ...state,
    phase: 'awaiting_move',
    die: 1,
    currentPlayerIndex: state.players.findIndex(
      (player) => player.id === playerId,
    ),
  };
  return applyAction(state, { type: 'MOVE_PAWN', pawnId: `${playerId}-0` });
}

function drawSeed(cardId: CardId): number {
  const cards = cardRegistry.all();
  for (let seed = 0; seed < 10000; seed++) {
    const roll = rollDie(seed);
    if (
      roll.value === 6 &&
      cards[Math.floor(nextRandom(roll.state).value * cards.length)].id ===
        cardId
    )
      return seed;
  }
  throw new Error('No draw seed');
}

function draw(
  cardId: CardId,
  state = createGame({ seed: 1, mode: 'tunisian' }),
) {
  return applyAction(
    { ...state, rngState: drawSeed(cardId), consecutiveSixes: 1 },
    { type: 'ROLL_DICE' },
  );
}

describe('Tunisian tile strategies', () => {
  it.each([
    ['cafe', 2, 2, true],
    ['taxi', 6, 10, false],
    ['impots', 10, 8, false],
    ['police', 15, -1, false],
    ['baguette', 19, 20, false],
    ['maman', 23, -1, false],
    ['plage', 28, 28, true],
    ['7keya', 32, 29, false],
    ['biere', 36, 35, false],
    ['derby', 41, 43, false],
  ] as const)(
    '%s resolves its registered landing effect',
    (id, index, destination, skip) => {
      const result = moveAt(index);
      expect(result.state.players[0].pawns[0].position).toBe(destination);
      expect(result.state.players[0].skipNextTurn).toBe(skip);
      expect(
        result.events.filter((event) => event.type === 'TILE_TRIGGERED'),
      ).toEqual([
        {
          type: 'TILE_TRIGGERED',
          tileId: id,
          playerId: 'red',
          pawnId: 'red-0',
        },
      ]);
    },
  );

  it('has ten unique unsafe tile indices and rejects duplicate strategy IDs', () => {
    const tiles = tileRegistry.all();
    expect(tiles).toHaveLength(10);
    expect(new Set(tiles.map((tile) => tile.index)).size).toBe(10);
    expect(tiles.every((tile) => !SAFE_TILES.includes(tile.index))).toBe(true);
    expect(() => new StrategyRegistry([tiles[0], tiles[0]])).toThrow(
      'Duplicate',
    );
    expect(Object.isFrozen(tiles[0])).toBe(true);
  });

  it('does not trigger pass-through tiles or chain taxi into impots', () => {
    const result = applyAction(
      {
        ...position(createGame({ seed: 1, mode: 'tunisian' }), 'red', [1]),
        phase: 'awaiting_move',
        die: 3,
      },
      { type: 'MOVE_PAWN', pawnId: 'red-0' },
    );
    expect(result.events.some((event) => event.type === 'TILE_TRIGGERED')).toBe(
      false,
    );
    expect(
      moveAt(6).events.filter((event) => event.type === 'TILE_TRIGGERED'),
    ).toHaveLength(1);
  });

  it('captures at both landing and effect destination', () => {
    let state = createGame({ seed: 1, mode: 'tunisian' });
    state = position(state, 'green', [45, 49]);
    const result = moveAt(6, 'red', state);
    expect(
      result.state.players[1].pawns.slice(0, 2).map((pawn) => pawn.position),
    ).toEqual([-1, -1]);
    expect(result.events.map((event) => event.type)).toEqual([
      'PAWN_MOVED',
      'PAWN_CAPTURED',
      'TILE_TRIGGERED',
      'PAWN_MOVED',
      'PAWN_CAPTURED',
      'TURN_ENDED',
    ]);
  });

  it('respects safe destinations and clamps backward effects at start', () => {
    const result = moveAt(
      10,
      'red',
      position(createGame({ seed: 1, mode: 'tunisian' }), 'green', [47]),
    );
    expect(result.state.players[1].pawns[0].position).toBe(47);
    const state = position(
      createGame({ seed: 1, mode: 'tunisian' }),
      'red',
      [1],
    );
    const player = state.players[0];
    expect(
      tileRegistry
        .get('7keya')
        .resolve({ state, player, pawn: player.pawns[0] }),
    ).toEqual({ kind: 'move', position: 0 });
  });

  it('uses the owner-relative route and clamps forward movement at finish', () => {
    const result = moveAt(6, 'green');
    expect(result.state.players[1].pawns[0].position).toBe(49);
    const state = position(
      createGame({ seed: 1, mode: 'tunisian' }),
      'red',
      [54],
    );
    expect(
      tileRegistry.get('taxi').resolve({
        state,
        player: state.players[0],
        pawn: state.players[0].pawns[0],
      }),
    ).toEqual({ kind: 'move', position: 56 });
  });

  it('skips the next turn without consuming RNG, then clears the penalty', () => {
    const landed = moveAt(2).state;
    const state = { ...landed, currentPlayerIndex: 0 };
    const result = applyAction(state, { type: 'ROLL_DICE' });
    expect(result.state.rngState).toBe(state.rngState);
    expect(result.state.players[0].skipNextTurn).toBe(false);
    expect(result.state.currentPlayerIndex).toBe(1);
    expect(result.events).toEqual([
      {
        type: 'TURN_ENDED',
        playerId: 'red',
        nextPlayerId: 'green',
        reason: 'skipped',
      },
    ]);
  });

  it('does not consume a pending skip during an extra roll', () => {
    const state = {
      ...moveAt(2).state,
      currentPlayerIndex: 0,
      consecutiveSixes: 1,
    };
    expect(applyAction(state, { type: 'ROLL_DICE' }).events[0].type).toBe(
      'DICE_ROLLED',
    );
  });

  it('leaves standard mode unchanged on special tiles and double six', () => {
    const standard = createGame({ seed: drawSeed('maman') });
    const state = {
      ...position(standard, 'red', [5]),
      phase: 'awaiting_move' as const,
      die: 1,
    };
    const result = applyAction(state, { type: 'MOVE_PAWN', pawnId: 'red-0' });
    expect(result.state.players[0].pawns[0].position).toBe(6);
    expect(result.events.some((event) => event.type === 'TILE_TRIGGERED')).toBe(
      false,
    );
    const rolled = applyAction(
      { ...standard, consecutiveSixes: 1 },
      { type: 'ROLL_DICE' },
    );
    expect(rolled.state.rngState).toBe(rollDie(standard.rngState).state);
    expect(rolled.events.some((event) => event.type === 'CARD_DRAWN')).toBe(
      false,
    );
  });
});

describe('Tunisian card strategies', () => {
  it("Ta mère t'appelle targets only own track pawns and sends the chosen one home to the yard", () => {
    const result = draw(
      'maman',
      position(
        createGame({ seed: 1, mode: 'tunisian' }),
        'red',
        [0, 5, 51, 56],
      ),
    );
    expect(result.state.phase).toBe('CHOOSE_TARGET');
    expect(getLegalTargets(result.state)).toEqual(['red-0', 'red-1']);
    const resolved = applyAction(result.state, {
      type: 'CHOOSE_TARGET',
      pawnId: 'red-1',
    });
    expect(resolved.state.players[0].pawns[1].position).toBe(-1);
    expect(resolved.state).toMatchObject({
      phase: 'awaiting_move',
      die: 6,
      pendingCard: null,
      consecutiveSixes: 2,
    });
    expect(getLegalMoves(resolved.state)).toContain('red-1');
  });

  it('3asba! targets unsafe opponent pawns, not safe, own, yard or home pawns', () => {
    let state = position(createGame({ seed: 1, mode: 'tunisian' }), 'red', [5]);
    state = position(state, 'green', [1, 0, 51, 56]);
    const result = draw('3asba', state);
    expect(getLegalTargets(result.state)).toEqual(['green-0']);
    const resolved = applyAction(result.state, {
      type: 'CHOOSE_TARGET',
      pawnId: 'green-0',
    });
    expect(resolved.state.players[1].pawns[0].position).toBe(-1);
    expect(resolved.events[0]).toMatchObject({
      type: 'PAWN_MOVED',
      from: 1,
      to: -1,
    });
  });

  it('El 7assel retreats three steps, clamps at start, without capture or tile effects', () => {
    let state = position(
      createGame({ seed: 1, mode: 'tunisian' }),
      'green',
      [5, 1],
    );
    state = position(state, 'red', [15]);
    const result = draw('el-hassel', state);
    const resolved = applyAction(result.state, {
      type: 'CHOOSE_TARGET',
      pawnId: 'green-0',
    });
    expect(resolved.state.players[1].pawns[0].position).toBe(2);
    expect(resolved.state.players[0].pawns[0].position).toBe(15);
    expect(
      resolved.events.some(
        (event) =>
          event.type === 'PAWN_CAPTURED' || event.type === 'TILE_TRIGGERED',
      ),
    ).toBe(false);
    expect(
      applyAction(result.state, { type: 'CHOOSE_TARGET', pawnId: 'green-1' })
        .state.players[1].pawns[1].position,
    ).toBe(0);
  });

  it('Tchitcha cancels a pending skip and explicitly reports when it has no effect', () => {
    const state = createGame({ seed: 1, mode: 'tunisian' });
    const skipped = {
      ...state,
      players: state.players.map((player, index) => ({
        ...player,
        skipNextTurn: index === 0,
      })),
    };
    const result = draw('tchitcha', skipped);
    expect(result.state.players[0].skipNextTurn).toBe(false);
    expect(result.state.phase).toBe('awaiting_move');
    expect(result.events.at(-1)).toMatchObject({
      type: 'CARD_RESOLVED',
      outcome: 'applied',
    });
    expect(draw('tchitcha').events.at(-1)).toMatchObject({
      type: 'CARD_RESOLVED',
      outcome: 'no_effect',
    });
  });

  it.each(['maman', '3asba', 'el-hassel'] as const)(
    '%s resolves explicitly without targets',
    (id) => {
      const result = draw(id);
      expect(result.state).toMatchObject({
        phase: 'awaiting_move',
        pendingCard: null,
        die: 6,
      });
      expect(result.events.at(-1)).toMatchObject({
        type: 'CARD_RESOLVED',
        outcome: 'no_targets',
      });
    },
  );

  it('blocks dice and pawn moves during target selection and rejects invalid targets', () => {
    const state = draw(
      '3asba',
      position(createGame({ seed: 1, mode: 'tunisian' }), 'green', [1]),
    ).state;
    expect(getLegalMoves(state)).toEqual([]);
    expect(() => applyAction(state, { type: 'ROLL_DICE' })).toThrow();
    expect(() =>
      applyAction(state, { type: 'MOVE_PAWN', pawnId: 'red-0' }),
    ).toThrow();
    expect(() =>
      applyAction(state, { type: 'CHOOSE_TARGET', pawnId: 'red-0' }),
    ).toThrow('Illegal card target');
    expect(() =>
      applyAction(createGame({ seed: 1 }), {
        type: 'CHOOSE_TARGET',
        pawnId: 'red-0',
      }),
    ).toThrow('No card');
  });

  it('consumes one extra RNG step for a draw and forfeits third six without a draw', () => {
    const result = draw('tchitcha');
    const rng = nextRandom(rollDie(drawSeed('tchitcha')).state);
    expect(result.state.rngState).toBe(rng.state);
    const third = applyAction(
      {
        ...result.state,
        phase: 'awaiting_roll',
        rngState: drawSeed('tchitcha'),
      },
      { type: 'ROLL_DICE' },
    );
    expect(third.events.map((event) => event.type)).toEqual([
      'DICE_ROLLED',
      'TURN_ENDED',
    ]);
    expect(third.events.at(-1)).toMatchObject({ reason: 'three_sixes' });
  });

  it('draws on real 6+6 and supports deterministic serialized complete-game replay', () => {
    const options = { seed: 12345, mode: 'tunisian' as const };
    let state = createGame(options);
    let replay = createGame(options);
    const seen = new Set<string>();
    for (let index = 0; index < 20000 && state.phase !== 'finished'; index++) {
      const action: Action =
        state.phase === 'awaiting_roll'
          ? { type: 'ROLL_DICE' }
          : state.phase === 'CHOOSE_TARGET'
            ? { type: 'CHOOSE_TARGET', pawnId: getLegalTargets(state)[0] }
            : { type: 'MOVE_PAWN', pawnId: getLegalMoves(state)[0] };
      const snapshot = structuredClone(state);
      const result = applyAction(state, action);
      expect(state).toEqual(snapshot);
      const restored: GameState = JSON.parse(JSON.stringify(replay));
      expect(applyAction(restored, action)).toEqual(result);
      replay = result.state;
      state = result.state;
      result.events.forEach((event) => seen.add(event.type));
    }
    expect(state.phase).toBe('finished');
    expect(seen).toContain('CARD_DRAWN');
    expect(seen).toContain('CARD_RESOLVED');
    expect(seen).toContain('TILE_TRIGGERED');
    expect(replay).toEqual(state);
  });
});
