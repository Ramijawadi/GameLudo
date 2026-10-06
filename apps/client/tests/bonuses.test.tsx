import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyAction,
  createGame,
  getLegalMoves,
  getLegalTargets,
  type GameState,
} from '@ludo/engine';
import { App } from '../src/App';
import { localGameStore } from '../src/store';

afterEach(() => localGameStore.getState().reset());

function startReady(position = 4, die = 6) {
  localGameStore.getState().reset();
  const initial = createGame({
    seed: 1,
    bonuses: true,
    players: ['red', 'yellow'],
  });
  let state: GameState = {
    ...initial,
    phase: 'awaiting_move',
    die,
    players: initial.players.map((player, index) =>
      index
        ? player
        : {
            ...player,
            bonuses: { extra_roll: 1, return_home: 1, crazy: 1 },
            pawns: player.pawns.map((pawn, index) =>
              index ? pawn : { ...pawn, position },
            ),
          },
    ),
  };
  localGameStore.setState({
    controller: {
      getState: () => state,
      getLegalMoves: () => getLegalMoves(state),
      getLegalTargets: () => getLegalTargets(state),
      dispatch: (action) => {
        const result = applyAction(state, action);
        state = result.state;
        return result;
      },
    },
    game: state,
    legalMoves: getLegalMoves(state),
    displayedPlayerId: 'red',
    visualPositions: Object.fromEntries(
      state.players.flatMap((player) =>
        player.pawns.map((pawn) => [pawn.id, pawn.position]),
      ),
    ),
  });
}

function drain() {
  act(() => {
    for (
      let tick = 0;
      localGameStore.getState().eventQueue.length && tick < 100;
      tick++
    )
      localGameStore.getState().advanceAnimation();
  });
  expect(localGameStore.getState().eventQueue).toHaveLength(0);
}

describe('stored bonus UI', () => {
  it('uses crazy as two independently selected moves of six before the original die', () => {
    startReady(8, 2);
    render(<App />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Red: Crazy +6 +6, 1 stored' }),
    );
    drain();
    expect(
      within(screen.getByRole('region', { name: 'Stored bonuses' })).getByText(
        'Crazy: 2 moves of 6 left. Tap a pawn. Then play your 2.',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Red pawn 1' }));
    drain();
    expect(localGameStore.getState().visualPositions['red-0']).toBe(14);
    expect(
      within(screen.getByRole('region', { name: 'Stored bonuses' })).getByText(
        'Crazy: 1 moves of 6 left. Tap a pawn. Then play your 2.',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Red pawn 2' }));
    drain();
    expect(localGameStore.getState().visualPositions['red-1']).toBe(0);
    expect(localGameStore.getState().game).toMatchObject({
      crazyMoves: 0,
      die: 2,
      phase: 'awaiting_move',
    });
    expect(
      screen
        .getByRole('button', { name: 'Red: Crazy +6 +6, 0 stored' })
        .hasAttribute('disabled'),
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Red pawn 2' }));
    drain();
    expect(localGameStore.getState().visualPositions['red-1']).toBe(2);
    expect(localGameStore.getState().displayedPlayerId).toBe('yellow');
  });
  it('always displays all player inventories and pickups, but only enables current-player actions after rolling', () => {
    localGameStore
      .getState()
      .start({ seed: 1, bonuses: true, players: ['red', 'yellow'] });
    render(<App />);
    expect(screen.getByRole('region', { name: 'Stored bonuses' })).toBeTruthy();
    expect(
      screen.getByLabelText('Ludo board').querySelectorAll('.bonus-pickup'),
    ).toHaveLength(6);
    expect(
      screen
        .getByRole('button', { name: 'Red: Extra roll, 0 stored' })
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Yellow: Return to yard, 0 stored' }),
    ).toBeTruthy();
  });

  it('reserves + after rolling, locks during playback and grants another roll after the move', () => {
    startReady(4, 2);
    render(<App />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Red: Extra roll, 1 stored' }),
    );
    expect(localGameStore.getState().game?.extraRolls).toBe(1);
    expect(
      screen
        .getByRole('button', { name: 'Red pawn 1' })
        .hasAttribute('disabled'),
    ).toBe(true);
    drain();
    expect(
      screen.getByText('Extra roll reserved. Move a pawn first.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Red pawn 1' }));
    drain();
    expect(localGameStore.getState().game?.currentPlayerIndex).toBe(0);
    expect(
      screen
        .getByRole('button', { name: 'Red: Tap die to roll' })
        .hasAttribute('disabled'),
    ).toBe(false);
    expect(
      screen.getByRole('button', { name: 'Red: Extra roll, 0 stored' }),
    ).toBeTruthy();
  });

  it('can cancel the house selection without spending it, then return the chosen board pawn to its yard', () => {
    startReady();
    render(<App />);
    const house = screen.getByRole('button', {
      name: 'Red: Return to yard, 1 stored',
    });
    fireEvent.click(house);
    expect(localGameStore.getState().homeBonusTargeting).toBe(true);
    expect(
      screen
        .getByRole('button', { name: 'Red pawn 2' })
        .hasAttribute('disabled'),
    ).toBe(true);
    fireEvent.click(house);
    expect(localGameStore.getState().homeBonusTargeting).toBe(false);
    expect(localGameStore.getState().game?.players[0].bonuses.return_home).toBe(
      1,
    );
    fireEvent.click(house);
    fireEvent.click(screen.getByRole('button', { name: 'Red pawn 1' }));
    expect(localGameStore.getState().homeBonusTargeting).toBe(false);
    drain();
    expect(localGameStore.getState().visualPositions['red-0']).toBe(-1);
    expect(localGameStore.getState().game?.phase).toBe('awaiting_move');
    expect(
      screen.getByRole('button', { name: 'Red: Return to yard, 0 stored' }),
    ).toBeTruthy();
  });

  it('removes a collected pickup and keeps the inventory visible on the next player turn', () => {
    startReady(10, 2);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Red pawn 1' }));
    drain();
    expect(
      screen.getByLabelText('Ludo board').querySelectorAll('.bonus-pickup'),
    ).toHaveLength(5);
    expect(
      screen
        .getByRole('button', { name: 'Red: Extra roll, 2 stored' })
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(localGameStore.getState().displayedPlayerId).toBe('yellow');
    act(() => localGameStore.getState().reset());
    expect(localGameStore.getState().homeBonusTargeting).toBe(false);
    expect(screen.queryByRole('region', { name: 'Stored bonuses' })).toBeNull();
  });
});
