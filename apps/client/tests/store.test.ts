import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createGame,
  getLegalMoves,
  getLegalTargets,
  rollDie,
  type Action,
  type GameState,
} from '@ludo/engine';
import { createLocalGameStore } from '../src/store';
import type { GameController } from '../src/controller';

function storeWithState(state: GameState) {
  const controller: GameController = {
    getState: () => state,
    getLegalMoves: () => getLegalMoves(state),
    getLegalTargets: () => getLegalTargets(state),
    dispatch: (action: Action) => {
      const result = applyAction(state, action);
      state = result.state;
      return result;
    },
  };
  const store = createLocalGameStore(() => controller);
  store.getState().start({ seed: state.initialSeed });
  return store;
}

function ready(
  position: number,
  die: number,
  otherPositions = [-1, -1, -1],
): GameState {
  const initial = createGame({ seed: 1 });
  return {
    ...initial,
    phase: 'awaiting_move',
    die,
    players: initial.players.map((player, index) =>
      index !== 0
        ? player
        : {
            ...player,
            pawns: player.pawns.map((pawn, pawnIndex) => ({
              ...pawn,
              position:
                pawnIndex === 0 ? position : otherPositions[pawnIndex - 1],
            })),
          },
    ),
  };
}

function drain(store: ReturnType<typeof createLocalGameStore>) {
  for (
    let ticks = 0;
    store.getState().eventQueue.length > 0 && ticks < 100;
    ticks++
  ) {
    store.getState().advanceAnimation();
  }
  expect(store.getState().eventQueue).toHaveLength(0);
}

describe('local game store', () => {
  it('explains forfeiting the third consecutive six during turn handover', () => {
    const seed = Array.from({ length: 1000 }, (_, index) => index).find(
      (candidate) => rollDie(candidate).value === 6,
    );
    if (seed === undefined) throw new Error('No six seed found');
    const store = storeWithState({
      ...createGame({ seed }),
      consecutiveSixes: 2,
    });
    store.getState().roll();
    expect(store.getState().displayedPlayerId).toBe('red');
    drain(store);
    expect(store.getState().displayedPlayerId).toBe('green');
    expect(store.getState().message).toContain('Three sixes');
    expect(store.getState().legalMoves).toHaveLength(0);
  });

  it('animates every intermediate track tile before handing over the turn', () => {
    const store = storeWithState(ready(4, 3));
    store.getState().selectPawn('red-0');
    store.getState().moveSelected();
    expect(store.getState().game?.players[0].pawns[0].position).toBe(7);
    expect(store.getState().visualPositions['red-0']).toBe(4);
    expect(store.getState().displayedPlayerId).toBe('red');
    for (const position of [5, 6, 7]) {
      store.getState().advanceAnimation();
      expect(store.getState().visualPositions['red-0']).toBe(position);
      expect(store.getState().displayedPlayerId).toBe('red');
    }
    store.getState().advanceAnimation();
    expect(store.getState().displayedPlayerId).toBe('green');
    expect(store.getState().eventQueue).toHaveLength(0);
  });

  it('animates track-to-home and yard entry correctly', () => {
    const store = storeWithState(ready(49, 3));
    store.getState().selectPawn('red-0');
    store.getState().moveSelected();
    for (const position of [50, 51, 52]) {
      store.getState().advanceAnimation();
      expect(store.getState().visualPositions['red-0']).toBe(position);
    }
    const yard = storeWithState(ready(-1, 6));
    yard.getState().selectPawn('red-0');
    yard.getState().moveSelected();
    yard.getState().advanceAnimation();
    expect(yard.getState().visualPositions['red-0']).toBe(0);
    expect(yard.getState().eventQueue).toHaveLength(0);
    expect(yard.getState().displayedPlayerId).toBe('red');
  });

  it('keeps a captured pawn on the board until the attacker lands', () => {
    const state = ready(12, 2);
    const store = storeWithState({
      ...state,
      players: state.players.map((player) =>
        player.id !== 'green'
          ? player
          : {
              ...player,
              pawns: player.pawns.map((pawn, index) => ({
                ...pawn,
                position: index === 0 ? 1 : -1,
              })),
            },
      ),
    });
    store.getState().selectPawn('red-0');
    store.getState().moveSelected();
    expect(store.getState().game?.players[1].pawns[0].position).toBe(-1);
    expect(store.getState().visualPositions['green-0']).toBe(1);
    store.getState().advanceAnimation();
    store.getState().advanceAnimation();
    expect(store.getState().visualPositions['red-0']).toBe(14);
    expect(store.getState().visualPositions['green-0']).toBe(1);
    store.getState().advanceAnimation();
    expect(store.getState().visualPositions['green-0']).toBe(-1);
    expect(store.getState().message).toContain('captured');
  });

  it('locks actions during playback and reports invalid selections/actions', () => {
    const store = storeWithState(ready(4, 3));
    store.getState().selectPawn('red-0');
    store.getState().moveSelected();
    const game = store.getState().game;
    store.getState().roll();
    expect(store.getState().game).toBe(game);
    expect(store.getState().error).toContain('Wait');
    store.getState().selectPawn('red-0');
    expect(store.getState().selectedPawnId).toBeNull();
    expect(store.getState().error).toContain('cannot move');
    drain(store);
    store.getState().moveSelected();
    expect(store.getState().error).toContain('Select');
  });

  it('shows roll results and explains automatically skipped turns', () => {
    const store = createLocalGameStore();
    store.getState().start({ seed: 1 });
    store.getState().roll();
    expect(store.getState().lastDie).toBeNull();
    store.getState().advanceAnimation();
    expect(store.getState().lastDie).toBe(4);
    expect(store.getState().lastRollPlayerId).toBe('red');
    expect(store.getState().displayedPlayerId).toBe('red');
    store.getState().advanceAnimation();
    expect(store.getState().message).toContain('No playable pawns');
    expect(store.getState().displayedPlayerId).toBe('green');
  });

  it('consumes finish and victory events after the final tile is reached', () => {
    const store = storeWithState(ready(55, 1, [56, 56, 56]));
    store.getState().selectPawn('red-0');
    store.getState().moveSelected();
    expect(store.getState().game?.winner).toBe('red');
    expect(store.getState().visualPositions['red-0']).toBe(55);
    store.getState().advanceAnimation();
    expect(store.getState().visualPositions['red-0']).toBe(56);
    expect(store.getState().eventQueue.map((event) => event.type)).toEqual([
      'PAWN_FINISHED',
      'GAME_WON',
    ]);
    drain(store);
    expect(store.getState().message).toContain('wins');
  });

  it('reset cancels a queued game and a new game starts clean', () => {
    const store = createLocalGameStore();
    store.getState().start({ seed: 1 });
    store.getState().roll();
    store.getState().reset();
    store.getState().advanceAnimation();
    expect(store.getState().game).toBeNull();
    expect(store.getState().visualPositions).toEqual({});
    store.getState().start({ seed: 42, players: ['blue', 'yellow'] });
    expect(store.getState().displayedPlayerId).toBe('blue');
    expect(store.getState().lastDie).toBeNull();
    expect(store.getState().eventQueue).toHaveLength(0);
    expect(store.getState().selectedPawnId).toBeNull();
  });

  it('reports invalid game options and rejected engine actions visibly', () => {
    const store = createLocalGameStore();
    store.getState().start({ seed: -1 });
    expect(store.getState().game).toBeNull();
    expect(store.getState().error).toContain('Seed');
    store.getState().start({ seed: 1 });
    store.getState().selectPawn('green-0');
    expect(store.getState().error).toContain('cannot move');
    const moving = storeWithState(ready(0, 1));
    moving.getState().roll();
    expect(moving.getState().error).toContain('Move a pawn');
  });

  it.each([2, 3, 4])(
    'plays a complete %s-player game through selection and the animation queue',
    (count) => {
      const players = (['red', 'green', 'yellow', 'blue'] as const).slice(
        0,
        count,
      );
      const store = createLocalGameStore();
      store.getState().start({ seed: 12345, players });
      for (
        let actions = 0;
        store.getState().game?.phase !== 'finished' && actions < 10000;
        actions++
      ) {
        if (store.getState().game?.phase === 'awaiting_roll')
          store.getState().roll();
        else {
          store.getState().selectPawn(store.getState().legalMoves[0]);
          store.getState().moveSelected();
        }
        drain(store);
        const state = store.getState();
        expect(state.error).toBeNull();
        for (const player of state.game?.players ?? []) {
          for (const pawn of player.pawns)
            expect(state.visualPositions[pawn.id]).toBe(pawn.position);
        }
        expect(state.displayedPlayerId).toBe(
          state.game?.players[state.game.currentPlayerIndex].id,
        );
      }
      expect(store.getState().game?.phase).toBe('finished');
      expect(store.getState().message).toContain('wins');
      expect(store.getState().eventQueue).toHaveLength(0);
    },
  );
});
