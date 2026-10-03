import {
  FINISHED_POSITION,
  PLAYER_COLORS,
  YARD_POSITION,
  isSafeTile,
  pawnToTile,
} from './board.js';
import { nextRandom, rollDie, validateSeed } from './rng.js';
import { cardRegistry, tileAt } from './tunisian/registry.js';
import type { Effect } from './tunisian/strategy.js';
import type {
  Action,
  CreateGameOptions,
  GameEvent,
  GameState,
  PlayerColor,
  Transition,
} from './types.js';

export function createGame({
  seed,
  players = PLAYER_COLORS,
  mode = 'standard',
}: CreateGameOptions): GameState {
  validateSeed(seed);
  if (mode !== 'standard' && mode !== 'tunisian')
    throw new RangeError('Unknown game mode.');
  if (
    players.length < 2 ||
    players.length > 4 ||
    new Set(players).size !== players.length ||
    players.some((id) => !PLAYER_COLORS.includes(id))
  ) {
    throw new RangeError('Choose two to four distinct player colors.');
  }
  return {
    players: players.map((id) => ({
      id,
      skipNextTurn: false,
      pawns: Array.from({ length: 4 }, (_, index) => ({
        id: `${id}-${index}`,
        position: YARD_POSITION,
      })),
    })),
    currentPlayerIndex: 0,
    phase: 'awaiting_roll',
    mode,
    pendingCard: null,
    die: null,
    consecutiveSixes: 0,
    initialSeed: seed,
    rngState: seed,
    winner: null,
  };
}

export function getLegalTargets(state: GameState): readonly string[] {
  if (state.phase !== 'CHOOSE_TARGET' || !state.pendingCard) return [];
  return cardRegistry.get(state.pendingCard).targets(state);
}

export function getLegalMoves(state: GameState): readonly string[] {
  if (state.phase !== 'awaiting_move' || state.die === null) return [];
  const die = state.die;
  return state.players[state.currentPlayerIndex].pawns
    .filter((pawn) =>
      pawn.position === YARD_POSITION
        ? die === 6
        : pawn.position < FINISHED_POSITION &&
          pawn.position + die <= FINISHED_POSITION,
    )
    .map((pawn) => pawn.id);
}

function endTurn(
  state: GameState,
  reason: 'move' | 'no_moves' | 'three_sixes' | 'skipped',
  events: GameEvent[],
): Transition {
  const currentPlayerIndex =
    (state.currentPlayerIndex + 1) % state.players.length;
  events.push({
    type: 'TURN_ENDED',
    playerId: state.players[state.currentPlayerIndex].id,
    nextPlayerId: state.players[currentPlayerIndex].id,
    reason,
  });
  return {
    state: {
      ...state,
      currentPlayerIndex,
      phase: 'awaiting_roll',
      die: null,
      consecutiveSixes: 0,
    },
    events,
  };
}

function setSkip(
  state: GameState,
  playerId: PlayerColor,
  skipNextTurn: boolean,
): GameState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId ? { ...player, skipNextTurn } : player,
    ),
  };
}

function relocate(
  state: GameState,
  playerId: PlayerColor,
  pawnId: string,
  position: number,
  capture: boolean,
  events: GameEvent[],
): GameState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  const pawn = player?.pawns.find((candidate) => candidate.id === pawnId);
  if (!pawn) throw new Error(`Unknown pawn: ${pawnId}.`);
  const destination = pawnToTile(playerId, position);
  events.push({
    type: 'PAWN_MOVED',
    playerId,
    pawnId,
    from: pawn.position,
    to: position,
  });
  return {
    ...state,
    players: state.players.map((candidate) => ({
      ...candidate,
      pawns: candidate.pawns.map((other) => {
        if (candidate.id === playerId)
          return other.id === pawnId ? { ...other, position } : other;
        const tile = pawnToTile(candidate.id, other.position);
        if (
          capture &&
          destination?.kind === 'track' &&
          !isSafeTile(destination.index) &&
          tile?.kind === 'track' &&
          tile.index === destination.index
        ) {
          events.push({
            type: 'PAWN_CAPTURED',
            playerId: candidate.id,
            pawnId: other.id,
            capturedBy: pawnId,
          });
          return { ...other, position: YARD_POSITION };
        }
        return other;
      }),
    })),
  };
}

function applyEffect(
  state: GameState,
  playerId: PlayerColor,
  pawnId: string,
  effect: Effect,
  capture: boolean,
  events: GameEvent[],
): GameState {
  if (effect.kind === 'move')
    return relocate(state, playerId, pawnId, effect.position, capture, events);
  return setSkip(state, playerId, effect.kind === 'skip');
}

function continueRoll(state: GameState, events: GameEvent[]): Transition {
  if (getLegalMoves(state).length === 0)
    return afterMoveOrNoMoves(state, 'no_moves', events);
  return { state, events };
}

function drawCard(state: GameState, events: GameEvent[]): Transition {
  const random = nextRandom(state.rngState);
  const cards = cardRegistry.all();
  const card = cards[Math.floor(random.value * cards.length)];
  const player = state.players[state.currentPlayerIndex];
  let drawn: GameState = {
    ...state,
    rngState: random.state,
    pendingCard: card.id,
  };
  events.push({ type: 'CARD_DRAWN', cardId: card.id, playerId: player.id });
  if (card.targeted && card.targets(drawn).length > 0) {
    return { state: { ...drawn, phase: 'CHOOSE_TARGET' }, events };
  }
  if (!card.targeted) {
    drawn = applyEffect(
      drawn,
      player.id,
      player.pawns[0].id,
      card.resolve({ state: drawn, player, pawn: player.pawns[0] }),
      false,
      events,
    );
  }
  events.push({
    type: 'CARD_RESOLVED',
    cardId: card.id,
    playerId: player.id,
    pawnId: null,
    outcome: card.targeted
      ? 'no_targets'
      : player.skipNextTurn
        ? 'applied'
        : 'no_effect',
  });
  return continueRoll({ ...drawn, pendingCard: null }, events);
}

function afterMoveOrNoMoves(
  state: GameState,
  reason: 'move' | 'no_moves',
  events: GameEvent[],
): Transition {
  if (state.die === 6) {
    return { state: { ...state, phase: 'awaiting_roll', die: null }, events };
  }
  return endTurn(state, reason, events);
}

export function applyAction(state: GameState, action: Action): Transition {
  if (state.phase === 'finished')
    throw new Error('The game has already finished.');
  const player = state.players[state.currentPlayerIndex];
  if (action.type === 'CHOOSE_TARGET') {
    if (state.phase !== 'CHOOSE_TARGET' || !state.pendingCard)
      throw new Error('No card is awaiting a target.');
    if (!getLegalTargets(state).includes(action.pawnId))
      throw new Error(`Illegal card target: ${action.pawnId}.`);
    const targetPlayer = state.players.find((candidate) =>
      candidate.pawns.some((pawn) => pawn.id === action.pawnId),
    );
    const target = targetPlayer?.pawns.find(
      (pawn) => pawn.id === action.pawnId,
    );
    if (!targetPlayer || !target)
      throw new Error(`Unknown target: ${action.pawnId}.`);
    const card = cardRegistry.get(state.pendingCard);
    const events: GameEvent[] = [];
    const resolved = applyEffect(
      state,
      targetPlayer.id,
      target.id,
      card.resolve({ state, player: targetPlayer, pawn: target }),
      false,
      events,
    );
    events.push({
      type: 'CARD_RESOLVED',
      cardId: card.id,
      playerId: player.id,
      pawnId: target.id,
      outcome: 'applied',
    });
    return continueRoll(
      { ...resolved, phase: 'awaiting_move', pendingCard: null },
      events,
    );
  }
  if (action.type === 'ROLL_DICE') {
    if (state.phase !== 'awaiting_roll')
      throw new Error('Move a pawn before rolling again.');
    if (
      state.mode === 'tunisian' &&
      player.skipNextTurn &&
      state.consecutiveSixes === 0
    ) {
      return endTurn(setSkip(state, player.id, false), 'skipped', []);
    }
    const roll = rollDie(state.rngState);
    const events: GameEvent[] = [
      { type: 'DICE_ROLLED', playerId: player.id, value: roll.value },
    ];
    const rolled: GameState = {
      ...state,
      rngState: roll.state,
      die: roll.value,
      phase: 'awaiting_move',
      consecutiveSixes: roll.value === 6 ? state.consecutiveSixes + 1 : 0,
    };
    if (rolled.consecutiveSixes === 3)
      return endTurn(rolled, 'three_sixes', events);
    if (state.mode === 'tunisian' && rolled.consecutiveSixes === 2)
      return drawCard(rolled, events);
    return continueRoll(rolled, events);
  }
  if (action.type !== 'MOVE_PAWN') throw new Error('Unknown game action.');
  if (state.phase !== 'awaiting_move' || state.die === null)
    throw new Error('Roll before moving a pawn.');
  if (!getLegalMoves(state).includes(action.pawnId))
    throw new Error(`Illegal pawn move: ${action.pawnId}.`);
  const pawn = player.pawns.find((candidate) => candidate.id === action.pawnId);
  if (!pawn) throw new Error(`Unknown pawn: ${action.pawnId}.`);
  const position =
    pawn.position === YARD_POSITION ? 0 : pawn.position + state.die;
  const events: GameEvent[] = [];
  let moved = relocate(state, player.id, pawn.id, position, true, events);
  const destination = pawnToTile(player.id, position);
  const strategy =
    state.mode === 'tunisian' && destination?.kind === 'track'
      ? tileAt(destination.index)
      : undefined;
  if (strategy) {
    events.push({
      type: 'TILE_TRIGGERED',
      tileId: strategy.id,
      playerId: player.id,
      pawnId: pawn.id,
    });
    const movedPlayer = moved.players[state.currentPlayerIndex];
    const movedPawn = movedPlayer.pawns.find(
      (candidate) => candidate.id === pawn.id,
    );
    if (!movedPawn) throw new Error(`Unknown pawn: ${pawn.id}.`);
    moved = applyEffect(
      moved,
      player.id,
      pawn.id,
      strategy.resolve({ state: moved, player: movedPlayer, pawn: movedPawn }),
      true,
      events,
    );
  }
  const players = moved.players;
  if (
    players[state.currentPlayerIndex].pawns.find(
      (candidate) => candidate.id === pawn.id,
    )?.position === FINISHED_POSITION
  ) {
    events.push({
      type: 'PAWN_FINISHED',
      playerId: player.id,
      pawnId: pawn.id,
    });
    if (
      players[state.currentPlayerIndex].pawns.every(
        (candidate) => candidate.position === FINISHED_POSITION,
      )
    ) {
      events.push({ type: 'GAME_WON', playerId: player.id });
      return {
        state: {
          ...moved,
          phase: 'finished',
          die: null,
          consecutiveSixes: 0,
          winner: player.id,
        },
        events,
      };
    }
  }
  return afterMoveOrNoMoves(moved, 'move', events);
}
