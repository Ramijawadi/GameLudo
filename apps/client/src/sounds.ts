import type { GameEvent } from '@ludo/engine';
import { usePreferences } from './i18n';

let context: AudioContext | null = null;

export async function toggleSound(): Promise<void> {
  if (usePreferences.getState().soundEnabled) {
    usePreferences.setState({ soundEnabled: false });
    return;
  }
  if (!window.AudioContext) {
    usePreferences.setState({
      soundError: 'soundUnavailable',
      soundErrorDetail: null,
      soundEnabled: false,
    });
    return;
  }
  try {
    context ??= new AudioContext();
    await context.resume();
    usePreferences.setState({
      soundEnabled: true,
      soundError: null,
      soundErrorDetail: null,
    });
  } catch (error) {
    usePreferences.setState({
      soundError: 'soundFailed',
      soundErrorDetail: error instanceof Error ? error.message : String(error),
      soundEnabled: false,
    });
  }
}

export function playEventSound(event: GameEvent): void {
  if (!usePreferences.getState().soundEnabled || !context) return;
  const audio = context;
  const notes: Partial<Record<GameEvent['type'], readonly number[]>> = {
    DICE_ROLLED: [330, 440],
    PAWN_MOVED: [520],
    PAWN_CAPTURED: [220, 140],
    GAME_WON: [523, 659, 784, 1047],
    CARD_DRAWN: [440, 660, 880],
  };
  const frequencies = notes[event.type];
  if (!frequencies) return;
  try {
    frequencies.forEach((frequency, index) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const start = audio.currentTime + index * 0.09;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.045, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.08);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(start);
      oscillator.stop(start + 0.09);
    });
  } catch (error) {
    usePreferences.setState({
      soundError: 'soundFailed',
      soundErrorDetail: error instanceof Error ? error.message : String(error),
      soundEnabled: false,
    });
  }
}
