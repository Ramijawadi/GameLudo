import {
  applyAction,
  createGame,
  getLegalMoves,
  getLegalTargets,
  type Action,
  type CreateGameOptions,
  type GameState,
  type Transition,
} from '@ludo/engine';

export interface GameController {
  getState(): GameState;
  getLegalMoves(): readonly string[];
  getLegalTargets(): readonly string[];
  dispatch(action: Action): Transition;
}

export class LocalController implements GameController {
  private state: GameState;

  constructor(options: CreateGameOptions) {
    this.state = createGame(options);
  }

  getState(): GameState {
    return this.state;
  }

  getLegalMoves(): readonly string[] {
    return getLegalMoves(this.state);
  }

  getLegalTargets(): readonly string[] {
    return getLegalTargets(this.state);
  }

  dispatch(action: Action): Transition {
    const result = applyAction(this.state, action);
    this.state = result.state;
    return result;
  }
}
