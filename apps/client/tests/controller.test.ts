import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createGame,
  getLegalMoves,
  type Action,
} from '@ludo/engine';
import { LocalController } from '../src/controller';

describe('LocalController', () => {
  it('delegates a complete game to the engine without changing results', () => {
    const options = { seed: 12345 };
    const controller = new LocalController(options);
    let expected = createGame(options);
    for (
      let index = 0;
      expected.phase !== 'finished' && index < 10000;
      index++
    ) {
      expect(controller.getState()).toEqual(expected);
      expect(controller.getLegalMoves()).toEqual(getLegalMoves(expected));
      const action: Action =
        expected.phase === 'awaiting_roll'
          ? { type: 'ROLL_DICE' }
          : { type: 'MOVE_PAWN', pawnId: getLegalMoves(expected)[0] };
      const transition = applyAction(expected, action);
      expect(controller.dispatch(action)).toEqual(transition);
      expected = transition.state;
    }
    expect(expected.phase).toBe('finished');
    expect(controller.getState()).toEqual(expected);
  });

  it('preserves state when the engine rejects an action', () => {
    const controller = new LocalController({ seed: 1 });
    const initial = controller.getState();
    expect(() =>
      controller.dispatch({ type: 'MOVE_PAWN', pawnId: 'red-0' }),
    ).toThrow();
    expect(controller.getState()).toBe(initial);
  });
});
