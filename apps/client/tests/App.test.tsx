import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyAction,
  createGame,
  getLegalMoves,
  getLegalTargets,
  rollDie,
  type GameState,
} from '@ludo/engine';
import { App } from '../src/App';
import { localGameStore } from '../src/store';

beforeEach(() => localGameStore.getState().reset());
afterEach(() => {
  localGameStore.getState().reset();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function sixSeed(): number {
  for (let seed = 0; seed < 1000; seed++)
    if (rollDie(seed).value === 6) return seed;
  throw new Error('No six seed');
}

describe('pass & play UI', () => {
  it('honors reduced motion without skipping event order', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      ...window.matchMedia('(prefers-reduced-motion: reduce)'),
      matches: true,
    });
    localGameStore.getState().start({ seed: 1 });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Roll dice' }));
    expect(localGameStore.getState().displayedPlayerId).toBe('red');
    await act(() => vi.runAllTimersAsync());
    expect(localGameStore.getState().lastDie).toBe(4);
    expect(localGameStore.getState().displayedPlayerId).toBe('green');
    expect(localGameStore.getState().eventQueue).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([2, 3, 4])('starts a %s-player game from setup', async (count) => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: `${count} players` }));
    await user.click(screen.getByRole('button', { name: 'Start local game' }));
    expect(localGameStore.getState().game?.players).toHaveLength(count);
    expect(
      screen.getByLabelText('Ludo board').querySelectorAll('.cell'),
    ).toHaveLength(225);
    expect(
      screen.getAllByRole('button', {
        name: /^(Red|Green|Yellow|Blue) pawn \d$/,
      }),
    ).toHaveLength(count * 4);
    expect(screen.getByRole('heading', { name: "Red's turn" })).toBeTruthy();
    const dice = screen.getAllByRole('button', { name: /Tap die to roll/ });
    expect(dice).toHaveLength(count);
    expect(dice.filter((die) => !die.hasAttribute('disabled'))).toHaveLength(1);
    expect(
      screen
        .getByRole('button', { name: 'Red: Tap die to roll' })
        .closest('.corner-dice.red')?.parentElement?.className,
    ).toBe('board-frame');
    expect(
      screen
        .getByRole('button', { name: 'Roll dice' })
        .hasAttribute('disabled'),
    ).toBe(false);
  });

  it('moves a playable board pawn with one tap and unlocks the extra roll', async () => {
    vi.useFakeTimers();
    localGameStore
      .getState()
      .start({ seed: sixSeed(), players: ['red', 'yellow'] });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Roll dice' }));
    expect(
      screen
        .getByRole('button', { name: 'Playing...' })
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen
        .getByRole('button', { name: 'Red pawn 1' })
        .hasAttribute('disabled'),
    ).toBe(true);
    await act(() => vi.runAllTimersAsync());
    const pawn = screen.getByRole('button', { name: 'Red pawn 1' });
    expect(pawn.classList.contains('playable')).toBe(true);
    fireEvent.click(pawn);
    fireEvent.click(pawn);
    expect(localGameStore.getState().game?.players[0].pawns[0].position).toBe(
      0,
    );
    expect(localGameStore.getState().error).toBeNull();
    expect(screen.queryByRole('button', { name: 'Move pawn 1' })).toBeNull();
    expect(localGameStore.getState().visualPositions['red-0']).toBe(-1);
    await act(() => vi.runAllTimersAsync());
    expect(localGameStore.getState().visualPositions['red-0']).toBe(0);
    expect(
      screen
        .getByRole('button', { name: 'Roll dice' })
        .hasAttribute('disabled'),
    ).toBe(false);
  });

  it('rolls once when the die is tapped, animates, and lands on the engine result', async () => {
    vi.useFakeTimers();
    const seed = sixSeed();
    const expected = rollDie(seed).value;
    localGameStore.getState().start({ seed, players: ['red', 'yellow'] });
    render(<App />);
    const die = screen.getByRole('button', { name: 'Red: Tap die to roll' });
    fireEvent.click(die);
    expect(die.hasAttribute('disabled')).toBe(true);
    expect(die.querySelector('.die-cube.spinning')).not.toBeNull();
    fireEvent.click(die);
    expect(
      localGameStore
        .getState()
        .eventQueue.filter((event) => event.type === 'DICE_ROLLED'),
    ).toHaveLength(1);
    await act(() => vi.runAllTimersAsync());
    expect(localGameStore.getState().lastDie).toBe(expected);
    expect(
      die.querySelector(`.die-cube.show-${expected}.landing`),
    ).not.toBeNull();
    expect(die.hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Move Red pawn 1' }));
    await act(() => vi.runAllTimersAsync());
    expect(die.hasAttribute('disabled')).toBe(false);
    fireEvent.click(die);
    await act(() => vi.runAllTimersAsync());
    expect(localGameStore.getState().lastDie).toBe(
      rollDie(rollDie(seed).state).value,
    );
    expect(localGameStore.getState().rollCount).toBe(2);
  });

  it.each(['Roll dice', 'Red: Tap die to roll'])(
    'rolls immediately on touch for %s without rolling again on release',
    async (name) => {
      const user = userEvent.setup();
      localGameStore.getState().start({ seed: 1, players: ['red', 'yellow'] });
      render(<App />);
      const control = screen.getByRole('button', { name });
      await user.pointer({ keys: '[TouchA>]', target: control });
      expect(
        localGameStore
          .getState()
          .eventQueue.filter((event) => event.type === 'DICE_ROLLED'),
      ).toHaveLength(1);
      act(() => {
        while (localGameStore.getState().eventQueue.length > 0) {
          localGameStore.getState().advanceAnimation();
        }
      });
      expect(localGameStore.getState().rollCount).toBe(1);
      await user.pointer({ keys: '[/TouchA]', target: control });
      expect(localGameStore.getState().eventQueue).toHaveLength(0);
      expect(localGameStore.getState().rollCount).toBe(1);
      expect(localGameStore.getState().error).toBeNull();
    },
  );

  it.each(['Roll dice', 'Red: Tap die to roll'])(
    'keeps keyboard activation working for %s',
    async (name) => {
      const user = userEvent.setup();
      localGameStore.getState().start({ seed: 1 });
      render(<App />);
      screen.getByRole('button', { name }).focus();
      await user.keyboard('{Enter}');
      expect(
        localGameStore
          .getState()
          .eventQueue.some((event) => event.type === 'DICE_ROLLED'),
      ).toBe(true);
    },
  );

  it('locks other corners and hands rolling to the next player while retaining each result', async () => {
    vi.useFakeTimers();
    localGameStore.getState().start({ seed: 1, players: ['red', 'yellow'] });
    render(<App />);
    const red = screen.getByRole('button', { name: 'Red: Tap die to roll' });
    const yellow = screen.getByRole('button', {
      name: 'Yellow: Tap die to roll',
    });
    expect(yellow.hasAttribute('disabled')).toBe(true);
    fireEvent.click(yellow);
    expect(localGameStore.getState().eventQueue).toHaveLength(0);
    fireEvent.click(red);
    expect(yellow.querySelector('.spinning')).toBeNull();
    await act(() => vi.runAllTimersAsync());
    expect(red.hasAttribute('disabled')).toBe(true);
    expect(yellow.hasAttribute('disabled')).toBe(false);
    expect(red.querySelector('.die-cube.show-4')).not.toBeNull();
    fireEvent.click(yellow);
    expect(yellow.querySelector('.die-cube.spinning')).not.toBeNull();
    await act(() => vi.runAllTimersAsync());
    const expected = rollDie(rollDie(1).state).value;
    expect(yellow.querySelector(`.die-cube.show-${expected}`)).not.toBeNull();
    expect(red.querySelector('.die-cube.show-4')).not.toBeNull();
    expect(localGameStore.getState().diceValues).toEqual({
      red: 4,
      yellow: expected,
    });
    act(() => localGameStore.getState().reset());
    expect(localGameStore.getState().diceValues).toEqual({});
  });

  it('moves the chosen numbered pawn directly even when board pawns overlap', async () => {
    const initial = createGame({ seed: 1, players: ['red', 'yellow'] });
    let state: GameState = {
      ...initial,
      phase: 'awaiting_move',
      die: 1,
      players: initial.players.map((player) => ({
        ...player,
        pawns: player.pawns.map((pawn) => ({
          ...pawn,
          position: player.id === 'red' ? 0 : -1,
        })),
      })),
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
      displayedPlayerId: 'red',
      legalMoves: ['red-0', 'red-1'],
      visualPositions: Object.fromEntries(
        state.players.flatMap((player) =>
          player.pawns.map((pawn) => [pawn.id, player.id === 'red' ? 0 : -1]),
        ),
      ),
    });
    const user = userEvent.setup();
    render(<App />);
    await user.pointer({
      keys: '[TouchA]',
      target: screen.getByRole('button', { name: 'Move Red pawn 2' }),
    });
    expect(localGameStore.getState().game?.players[0].pawns[1].position).toBe(
      1,
    );
    expect(localGameStore.getState().game?.players[0].pawns[0].position).toBe(
      0,
    );
    act(() => {
      while (localGameStore.getState().eventQueue.length > 0) {
        localGameStore.getState().advanceAnimation();
      }
    });
    expect(localGameStore.getState().visualPositions['red-1']).toBe(1);
  });

  it('cancels or confirms restarting without losing the game accidentally', async () => {
    localGameStore.getState().start({ seed: 1 });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'New game' }));
    expect(screen.getByRole('dialog', { name: 'Start over?' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Keep playing' }));
    expect(localGameStore.getState().game).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'New game' }));
    await user.click(
      screen.getByRole('button', { name: 'End game and return to setup' }),
    );
    expect(localGameStore.getState().game).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Start local game' }),
    ).toBeTruthy();
  });

  it('announces victory only after the event queue has completed', () => {
    const state = createGame({ seed: 1 });
    localGameStore.setState({
      game: { ...state, phase: 'finished', winner: 'red' },
      displayedPlayerId: 'red',
      visualPositions: Object.fromEntries(
        state.players.flatMap((player) =>
          player.pawns.map((pawn) => [pawn.id, player.id === 'red' ? 56 : -1]),
        ),
      ),
      eventQueue: [{ type: 'GAME_WON', playerId: 'red' }],
    });
    render(<App />);
    expect(screen.queryByRole('heading', { name: 'Red wins!' })).toBeNull();
    act(() => localGameStore.getState().advanceAnimation());
    expect(screen.getByRole('heading', { name: 'Red wins!' })).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Select a pawn to move' }),
    ).toBeNull();
  });

  it('renders engine errors as an alert', () => {
    localGameStore.getState().start({ seed: -1 });
    render(<App />);
    expect(screen.getByRole('alert').textContent).toContain('Seed');
  });

  it('cleans up timers if a queued game is reset', async () => {
    vi.useFakeTimers();
    localGameStore.getState().start({ seed: 1 });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Roll dice' }));
    act(() => localGameStore.getState().reset());
    await act(() => vi.runAllTimersAsync());
    expect(localGameStore.getState().lastDie).toBeNull();
    expect(localGameStore.getState().game).toBeNull();
  });
});
