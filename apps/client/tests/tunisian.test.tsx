import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  cardRegistry,
  getLegalTargets,
  nextRandom,
  rollDie,
  type CardId,
} from '@ludo/engine';
import { App } from '../src/App';
import { createLocalGameStore, localGameStore } from '../src/store';
import { translate, usePreferences } from '../src/i18n';
import { en } from '../src/i18n/en';
import { fr } from '../src/i18n/fr';
import { tn } from '../src/i18n/tn';
import { playEventSound, toggleSound } from '../src/sounds';

function doubleSixSeed(cardId: CardId): number {
  for (let seed = 0; seed < 100000; seed++) {
    const first = rollDie(seed);
    const second = rollDie(first.state);
    const random = nextRandom(second.state);
    if (
      first.value === 6 &&
      second.value === 6 &&
      cardRegistry.all()[Math.floor(random.value * 4)].id === cardId
    )
      return seed;
  }
  throw new Error('No matching seed');
}

function drain(store = localGameStore) {
  for (
    let count = 0;
    store.getState().eventQueue.length && count < 100;
    count++
  ) {
    if (store.getState().activeCard) store.getState().dismissCard();
    store.getState().advanceAnimation();
  }
  if (store.getState().activeCard) store.getState().dismissCard();
  expect(store.getState().eventQueue).toHaveLength(0);
}

beforeEach(() => {
  localGameStore.getState().reset();
  usePreferences.setState({
    language: 'en',
    soundEnabled: false,
    soundError: null,
    soundErrorDetail: null,
  });
});
afterEach(() => {
  localGameStore.getState().reset();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Tunisian client', () => {
  it('opts into Tunisian mode and shows all ten special board tiles', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Tunisian mode/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start local game' }));
    expect(localGameStore.getState().game?.mode).toBe('tunisian');
    expect(
      screen.getByLabelText('Ludo board').querySelectorAll('.special-tile'),
    ).toHaveLength(10);
  });

  it('pauses for the double-six card, then allows target selection and resumes the pending six', async () => {
    vi.useFakeTimers();
    localGameStore
      .getState()
      .start({ seed: doubleSixSeed('maman'), mode: 'tunisian' });
    localGameStore.getState().roll();
    drain();
    localGameStore.getState().selectPawn('red-0');
    localGameStore.getState().moveSelected();
    drain();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Roll dice' }));
    await act(() => vi.runAllTimersAsync());
    expect(
      screen.getByRole('dialog', { name: "Ta mère t'appelle" }),
    ).toBeTruthy();
    expect(localGameStore.getState().activeCard).toBe('maman');
    const state = localGameStore.getState().game;
    act(() => localGameStore.getState().roll());
    expect(localGameStore.getState().game).toBe(state);
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Choose a target',
      }),
    );
    await act(() => vi.runAllTimersAsync());
    const pawn = screen.getByRole('button', { name: 'Select Red pawn 1' });
    expect(pawn.hasAttribute('disabled')).toBe(false);
    fireEvent.click(pawn);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm target' }));
    await act(() => vi.runAllTimersAsync());
    expect(localGameStore.getState().visualPositions['red-0']).toBe(-1);
    expect(localGameStore.getState().game).toMatchObject({
      phase: 'awaiting_move',
      die: 6,
      pendingCard: null,
    });
    expect(
      screen
        .getByRole('button', { name: 'Select Red pawn 1' })
        .hasAttribute('disabled'),
    ).toBe(false);
  });

  it.each(['3asba', 'el-hassel', 'tchitcha'] as const)(
    'explains %s without an applicable target or penalty before continuing playback',
    async (cardId) => {
      vi.useFakeTimers();
      localGameStore.getState().start({
        seed: doubleSixSeed(cardId),
        mode: 'tunisian',
        players: ['red', 'yellow'],
      });
      localGameStore.getState().roll();
      drain();
      localGameStore.getState().selectPawn('red-0');
      localGameStore.getState().moveSelected();
      drain();
      render(<App />);
      fireEvent.click(screen.getByRole('button', { name: 'Roll dice' }));
      await act(() => vi.runAllTimersAsync());
      expect(
        screen.getByRole('dialog', { name: cardRegistry.get(cardId).title }),
      ).toBeTruthy();
      expect(
        screen.getByText(
          cardId === 'tchitcha'
            ? 'No pending penalty. Your six is still playable.'
            : 'No eligible target. Your six is still playable.',
        ),
      ).toBeTruthy();
      expect(localGameStore.getState().eventQueue[0].type).toBe(
        'CARD_RESOLVED',
      );
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      await act(() => vi.runAllTimersAsync());
      expect(localGameStore.getState().eventQueue).toHaveLength(0);
    },
  );

  it('animates backward effect movement one tile at a time and returns to yard immediately', () => {
    localGameStore.getState().start({ seed: 1 });
    localGameStore.setState({
      visualPositions: { 'red-0': 10 },
      eventQueue: [
        {
          type: 'PAWN_MOVED',
          playerId: 'red',
          pawnId: 'red-0',
          from: 10,
          to: 7,
        },
      ],
    });
    for (const position of [9, 8, 7]) {
      localGameStore.getState().advanceAnimation();
      expect(localGameStore.getState().visualPositions['red-0']).toBe(position);
    }
    localGameStore.setState({
      eventQueue: [
        {
          type: 'PAWN_MOVED',
          playerId: 'red',
          pawnId: 'red-0',
          from: 7,
          to: -1,
        },
      ],
    });
    localGameStore.getState().advanceAnimation();
    expect(localGameStore.getState().visualPositions['red-0']).toBe(-1);
  });

  it('shows a reaction for exactly two seconds, replacing repeated reactions and clearing on reset', () => {
    vi.useFakeTimers();
    localGameStore.getState().start({ seed: 1 });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'React 😂' }));
    expect(screen.getByRole('status').textContent).toBe('Red: 😂');
    act(() => vi.advanceTimersByTime(1000));
    fireEvent.click(screen.getByRole('button', { name: 'React 🔥' }));
    act(() => vi.advanceTimersByTime(1999));
    expect(screen.getByRole('status').textContent).toBe('Red: 🔥');
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole('status').textContent).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'React 🇹🇳' }));
    act(() => localGameStore.getState().reset());
    expect(screen.queryByRole('status')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('switches setup, game labels and tile descriptions between French and Tunisian', () => {
    render(<App />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), {
      target: { value: 'fr' },
    });
    expect(
      screen.getByRole('button', { name: 'Commencer la partie' }),
    ).toBeTruthy();
    expect(document.documentElement.lang).toBe('fr');
    fireEvent.click(screen.getByRole('checkbox', { name: /Mode tunisien/ }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Commencer la partie' }),
    );
    expect(
      screen.getByRole('heading', { name: 'Au tour de Rouge' }),
    ).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox', { name: 'Langue' }), {
      target: { value: 'tn' },
    });
    expect(screen.getByRole('heading', { name: 'Tour A7mer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Armi el dé' })).toBeTruthy();
    expect(document.documentElement.lang).toBe('aeb-Latn');
    expect(screen.getByTitle('9ahwa: Tour jey yet3adda.')).toBeTruthy();
  });

  it.each([2, 3, 4])(
    'finishes a %s-player Tunisian game through the store and card queue',
    (count) => {
      const store = createLocalGameStore();
      store.getState().start({
        seed: 12345,
        mode: 'tunisian',
        players: (['red', 'green', 'yellow', 'blue'] as const).slice(0, count),
      });
      for (
        let index = 0;
        index < 20000 && store.getState().game?.phase !== 'finished';
        index++
      ) {
        const game = store.getState().game;
        if (!game) throw new Error('No game');
        if (game.phase === 'awaiting_roll') store.getState().roll();
        else if (game.phase === 'CHOOSE_TARGET') {
          store.getState().selectPawn(getLegalTargets(game)[0]);
          store.getState().chooseSelectedTarget();
        } else {
          store.getState().selectPawn(store.getState().legalMoves[0]);
          store.getState().moveSelected();
        }
        drain(store);
        expect(store.getState().error).toBeNull();
        store
          .getState()
          .game?.players.forEach((player) =>
            player.pawns.forEach((pawn) =>
              expect(store.getState().visualPositions[pawn.id]).toBe(
                pawn.position,
              ),
            ),
          );
      }
      expect(store.getState().game?.phase).toBe('finished');
      expect(store.getState().message).toContain('wins');
    },
  );
});

describe('localization and sound', () => {
  it('has matching complete dictionaries, interpolates parameters, and rejects missing values', () => {
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
    expect(Object.keys(tn).sort()).toEqual(Object.keys(en).sort());
    expect(Object.values(fr).every(Boolean)).toBe(true);
    expect(Object.values(tn).every(Boolean)).toBe(true);
    expect(translate('fr', 'movePawn', { number: 4 })).toBe(
      'Déplacer le pion 4',
    );
    expect(() => translate('tn', 'movePawn')).toThrow(
      'Missing translation parameter',
    );
  });

  it('reports unsupported audio explicitly without enabling sounds', async () => {
    vi.stubGlobal('AudioContext', undefined);
    await toggleSound();
    expect(usePreferences.getState().soundError).toBe('soundUnavailable');
    expect(usePreferences.getState().soundEnabled).toBe(false);
  });

  it('unlocks audio on user request, generates notes, and respects mute', async () => {
    const param = () => ({
      value: 0,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    });
    const oscillators: { type: string; onended: (() => void) | null }[] = [];
    const createOscillator = vi.fn(() => {
      const oscillator = {
        type: 'sine',
        frequency: param(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      };
      oscillators.push(oscillator);
      return oscillator;
    });
    const filter = {
      type: 'allpass',
      frequency: param(),
      Q: param(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    const createGain = () => ({
      gain: param(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    });
    const resume = vi.fn(async () => {});
    vi.stubGlobal(
      'AudioContext',
      class {
        currentTime = 0;
        destination = {};
        resume = resume;
        createOscillator = createOscillator;
        createGain = createGain;
        createBiquadFilter = () => filter;
      },
    );
    await toggleSound();
    expect(resume).toHaveBeenCalledOnce();
    expect(usePreferences.getState().soundEnabled).toBe(true);
    playEventSound({ type: 'GAME_WON', playerId: 'red' });
    expect(createOscillator).toHaveBeenCalledTimes(4);
    playEventSound({ type: 'DICE_ROLLED', playerId: 'red', value: 6 });
    expect(createOscillator).toHaveBeenCalledTimes(7);
    expect(oscillators.slice(4).map((oscillator) => oscillator.type)).toEqual([
      'sine',
      'sawtooth',
      'square',
    ]);
    expect(filter.type).toBe('lowpass');
    oscillators[5].onended?.();
    expect(filter.disconnect).toHaveBeenCalledOnce();
    await toggleSound();
    playEventSound({ type: 'DICE_ROLLED', playerId: 'red', value: 6 });
    expect(createOscillator).toHaveBeenCalledTimes(7);
    expect(usePreferences.getState().soundEnabled).toBe(false);
    resume.mockRejectedValueOnce(new Error('Audio blocked'));
    await toggleSound();
    expect(usePreferences.getState().soundEnabled).toBe(false);
    expect(usePreferences.getState().soundError).toBe('soundFailed');
    expect(usePreferences.getState().soundErrorDetail).toBe('Audio blocked');
  });
});
