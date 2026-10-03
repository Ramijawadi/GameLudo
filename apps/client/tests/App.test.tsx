import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGame, rollDie } from '@ludo/engine';
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
    expect(
      screen
        .getByRole('button', { name: 'Roll dice' })
        .hasAttribute('disabled'),
    ).toBe(false);
  });

  it('rolls, highlights/selects a playable board pawn, confirms its move and unlocks the extra roll', async () => {
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
    expect(pawn.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Move pawn 1' }));
    expect(localGameStore.getState().visualPositions['red-0']).toBe(-1);
    await act(() => vi.runAllTimersAsync());
    expect(localGameStore.getState().visualPositions['red-0']).toBe(0);
    expect(
      screen
        .getByRole('button', { name: 'Roll dice' })
        .hasAttribute('disabled'),
    ).toBe(false);
  });

  it('offers separate large selection buttons for overlapping pawns', async () => {
    const state = createGame({ seed: 1, players: ['red', 'yellow'] });
    localGameStore.setState({
      game: { ...state, phase: 'awaiting_move', die: 1 },
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
    await user.click(screen.getByRole('button', { name: 'Select Red pawn 2' }));
    expect(
      screen
        .getByRole('button', { name: 'Move pawn 2' })
        .hasAttribute('disabled'),
    ).toBe(false);
    expect(localGameStore.getState().selectedPawnId).toBe('red-1');
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
