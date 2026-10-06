import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type {
  Action,
  CardId,
  CreateGameOptions,
  GameEvent,
  GameState,
  PlayerColor,
} from '@ludo/engine';
import { LocalController, type GameController } from './controller';

export interface LocalGameStore {
  controller: GameController | null;
  game: GameState | null;
  legalMoves: readonly string[];
  legalTargets: readonly string[];
  activeCard: CardId | null;
  lastMessageEvent: GameEvent | null;
  selectedPawnId: string | null;
  eventQueue: readonly GameEvent[];
  visualPositions: Readonly<Record<string, number>>;
  displayedPlayerId: PlayerColor | null;
  lastDie: number | null;
  diceValues: Partial<Record<PlayerColor, number>>;
  lastRollPlayerId: PlayerColor | null;
  rollCount: number;
  message: string;
  error: string | null;
  start(options: CreateGameOptions): void;
  reset(): void;
  selectPawn(pawnId: string): void;
  roll(): void;
  moveSelected(): void;
  chooseSelectedTarget(): void;
  dismissCard(): void;
  advanceAnimation(): void;
}

const initial = {
  controller: null,
  game: null,
  legalMoves: [],
  legalTargets: [],
  activeCard: null,
  lastMessageEvent: null,
  selectedPawnId: null,
  eventQueue: [],
  visualPositions: {},
  displayedPlayerId: null,
  lastDie: null,
  diceValues: {},
  lastRollPlayerId: null,
  rollCount: 0,
  message: '',
  error: null,
} satisfies Omit<
  LocalGameStore,
  | 'start'
  | 'reset'
  | 'selectPawn'
  | 'roll'
  | 'moveSelected'
  | 'advanceAnimation'
  | 'chooseSelectedTarget'
  | 'dismissCard'
>;

export const colorLabel = (color: PlayerColor): string =>
  color.charAt(0).toUpperCase() + color.slice(1);

export function createLocalGameStore(
  controllerFactory: (options: CreateGameOptions) => GameController = (
    options,
  ) => new LocalController(options),
) {
  return createStore<LocalGameStore>((set, get) => {
    const reportError = (error: unknown) =>
      set({ error: error instanceof Error ? error.message : String(error) });

    function dispatch(action: Action): void {
      const { controller, eventQueue, activeCard } = get();
      if (!controller || eventQueue.length > 0 || activeCard) {
        set({
          error: 'Wait for the current animation before taking an action.',
        });
        return;
      }
      try {
        const result = controller.dispatch(action);
        set({
          game: result.state,
          eventQueue: result.events,
          legalMoves: controller.getLegalMoves(),
          legalTargets: controller.getLegalTargets(),
          selectedPawnId: null,
          message: '',
          lastMessageEvent: null,
          error: null,
        });
      } catch (error) {
        reportError(error);
      }
    }

    return {
      ...initial,
      start(options) {
        try {
          const controller = controllerFactory(options);
          const game = controller.getState();
          set({
            ...initial,
            controller,
            game,
            legalMoves: controller.getLegalMoves(),
            legalTargets: controller.getLegalTargets(),
            displayedPlayerId: game.players[game.currentPlayerIndex].id,
            visualPositions: Object.fromEntries(
              game.players.flatMap((player) =>
                player.pawns.map((pawn) => [pawn.id, pawn.position]),
              ),
            ),
          });
        } catch (error) {
          reportError(error);
        }
      },
      reset() {
        set(initial);
      },
      selectPawn(pawnId) {
        const { eventQueue, legalMoves, legalTargets, activeCard, game } =
          get();
        const legal =
          game?.phase === 'CHOOSE_TARGET' ? legalTargets : legalMoves;
        if (eventQueue.length > 0 || activeCard || !legal.includes(pawnId)) {
          set({ error: 'That pawn cannot move right now.' });
          return;
        }
        set({ selectedPawnId: pawnId, error: null });
      },
      roll() {
        dispatch({ type: 'ROLL_DICE' });
      },
      moveSelected() {
        const pawnId = get().selectedPawnId;
        if (!pawnId) {
          set({ error: 'Select a highlighted pawn first.' });
          return;
        }
        dispatch({ type: 'MOVE_PAWN', pawnId });
      },
      chooseSelectedTarget() {
        const pawnId = get().selectedPawnId;
        if (!pawnId) {
          set({ error: 'Select a highlighted target first.' });
          return;
        }
        dispatch({ type: 'CHOOSE_TARGET', pawnId });
      },
      dismissCard() {
        set({ activeCard: null });
      },
      advanceAnimation() {
        const { eventQueue, visualPositions, activeCard } = get();
        if (activeCard) return;
        const event = eventQueue[0];
        if (!event) return;
        const rest = eventQueue.slice(1);
        switch (event.type) {
          case 'DICE_ROLLED':
            set({
              eventQueue: rest,
              lastDie: event.value,
              diceValues: {
                ...get().diceValues,
                [event.playerId]: event.value,
              },
              lastRollPlayerId: event.playerId,
              rollCount: get().rollCount + 1,
              message: `${colorLabel(event.playerId)} rolled ${event.value}.`,
              lastMessageEvent: event,
            });
            break;
          case 'PAWN_MOVED': {
            const position = visualPositions[event.pawnId];
            const next =
              event.to === -1
                ? -1
                : event.from === -1
                  ? 0
                  : position + Math.sign(event.to - position);
            set({
              visualPositions: { ...visualPositions, [event.pawnId]: next },
              eventQueue: next === event.to ? rest : eventQueue,
            });
            break;
          }
          case 'PAWN_CAPTURED':
            set({
              visualPositions: { ...visualPositions, [event.pawnId]: -1 },
              eventQueue: rest,
              message: `${colorLabel(event.playerId)} pawn captured and sent to the yard.`,
              lastMessageEvent: event,
            });
            break;
          case 'PAWN_FINISHED':
            set({
              eventQueue: rest,
              message: `${colorLabel(event.playerId)} brought a pawn home!`,
              lastMessageEvent: event,
            });
            break;
          case 'TURN_ENDED':
            set({
              eventQueue: rest,
              displayedPlayerId: event.nextPlayerId,
              lastMessageEvent:
                event.reason === 'move' ? get().lastMessageEvent : event,
              message:
                event.reason === 'three_sixes'
                  ? 'Three sixes in a row. Turn forfeited.'
                  : event.reason === 'no_moves'
                    ? 'No playable pawns. Turn passed.'
                    : event.reason === 'skipped'
                      ? 'Relax! Your turn is skipped.'
                      : get().message,
            });
            break;
          case 'GAME_WON':
            set({
              eventQueue: rest,
              message: `${colorLabel(event.playerId)} wins! All four pawns are home.`,
              lastMessageEvent: event,
            });
            break;
          case 'TILE_TRIGGERED':
            set({
              eventQueue: rest,
              lastMessageEvent: event,
              message: `Tile: ${event.tileId}.`,
            });
            break;
          case 'CARD_DRAWN':
            set({
              eventQueue: rest,
              activeCard: event.cardId,
              lastMessageEvent: event,
              message: 'Double six! Draw a card.',
            });
            break;
          case 'CARD_RESOLVED':
            set({
              eventQueue: rest,
              lastMessageEvent: event,
              message: `Card resolved: ${event.outcome}.`,
            });
            break;
        }
      },
    };
  });
}

export const localGameStore = createLocalGameStore();

export function useGameStore<T>(selector: (state: LocalGameStore) => T): T {
  return useStore(localGameStore, selector);
}
