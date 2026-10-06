import { create } from 'zustand';
import type { GameEvent, PlayerColor } from '@ludo/engine';
import { en, type MessageKey } from './en';
import { fr } from './fr';
import { tn } from './tn';

export type Language = 'en' | 'fr' | 'tn';
export const usePreferences = create<{
  language: Language;
  soundEnabled: boolean;
  soundError: 'soundUnavailable' | 'soundFailed' | null;
  soundErrorDetail: string | null;
  setLanguage(language: Language): void;
}>((set) => ({
  language: 'en',
  soundEnabled: false,
  soundError: null,
  soundErrorDetail: null,
  setLanguage: (language) => set({ language }),
}));

const dictionaries = { en, fr, tn };
const errorKeys = [
  'errorWait',
  'errorPawn',
  'errorSelect',
  'errorTarget',
  'errorFinished',
  'errorMoveFirst',
  'errorRollFirst',
  'errorNoCard',
  'errorSeed',
  'errorPlayers',
  'errorMode',
  'errorBonusPhase',
  'errorBonusMissing',
  'errorBonusArmed',
  'errorBonusTarget',
  'errorCrazyPending',
  'errorCrazyNoMoves',
] as const;

export function localizeError(language: Language, message: string): string {
  const key = errorKeys.find((key) => en[key] === message);
  if (key) return translate(language, key);
  const target = /^Illegal card target: (.+)\.$/.exec(message);
  if (target)
    return translate(language, 'errorIllegalTarget', { id: target[1] });
  const pawn = /^Illegal pawn move: (.+)\.$/.exec(message);
  if (pawn) return translate(language, 'errorIllegalPawn', { id: pawn[1] });
  return message;
}
export function translate(
  language: Language,
  key: MessageKey,
  values: Record<string, string | number> = {},
): string {
  return dictionaries[language][key].replace(
    /\{(\w+)\}/g,
    (_, name: string) => {
      if (!(name in values))
        throw new Error(`Missing translation parameter: ${name}.`);
      return String(values[name]);
    },
  );
}

export function useTranslation() {
  const language = usePreferences((state) => state.language);
  return {
    language,
    t: (key: MessageKey, values?: Record<string, string | number>) =>
      translate(language, key, values),
    playerName: (color: PlayerColor) => translate(language, color),
  };
}

export function eventMessage(language: Language, event: GameEvent): string {
  const player = translate(language, event.playerId);
  switch (event.type) {
    case 'BONUS_COLLECTED':
    case 'BONUS_USED':
      return translate(
        language,
        event.type === 'BONUS_COLLECTED' ? 'bonusCollected' : 'bonusUsed',
        {
          player,
          bonus: translate(
            language,
            event.bonusId === 'extra_roll'
              ? 'bonusExtra'
              : event.bonusId === 'crazy'
                ? 'bonusCrazy'
                : 'bonusHome',
          ),
        },
      );
    case 'DICE_ROLLED':
      return translate(language, 'rolled', { player, value: event.value });
    case 'PAWN_CAPTURED':
      return translate(language, 'capture', { player });
    case 'PAWN_FINISHED':
      return translate(language, 'pawnHome', { player });
    case 'GAME_WON':
      return translate(language, 'wonMessage', { player });
    case 'TURN_ENDED':
      return translate(
        language,
        event.reason === 'three_sixes'
          ? 'threeSixes'
          : event.reason === 'skipped'
            ? 'skipped'
            : 'noMoves',
        { player },
      );
    case 'TILE_TRIGGERED':
      return translate(language, 'tileEffect', {
        tile: translate(language, `tile_${event.tileId}`),
        effect: translate(language, `effect_${event.tileId}`),
      });
    case 'CARD_DRAWN':
      return translate(language, 'drawn');
    case 'CARD_RESOLVED':
      return translate(
        language,
        event.outcome === 'no_targets'
          ? 'noTargets'
          : event.outcome === 'no_effect'
            ? 'noEffect'
            : 'applied',
      );
    case 'PAWN_MOVED':
      return '';
  }
}
