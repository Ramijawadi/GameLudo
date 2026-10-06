import type { GameEvent } from '@ludo/engine';
import { usePreferences } from './i18n';

let context: AudioContext | null = null;
let pendingResume: Promise<void> | null = null;

function resumeAudio(audio: AudioContext): Promise<void> {
  if (!pendingResume) {
    pendingResume = audio
      .resume()
      .then(() => {
        if (audio.state !== 'running')
          throw new Error('Audio playback could not be resumed.');
      })
      .finally(() => {
        pendingResume = null;
      });
  }
  return pendingResume;
}

export async function resumeSound(): Promise<void> {
  if (!usePreferences.getState().soundEnabled || !context) return;
  try {
    if (context.state !== 'running') await resumeAudio(context);
  } catch (error) {
    reportSoundError(error);
  }
}

function reportSoundError(error: unknown): void {
  usePreferences.setState({
    soundError: 'soundFailed',
    soundErrorDetail: error instanceof Error ? error.message : String(error),
    soundEnabled: false,
  });
}

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
    if (!context || context.state === 'closed') context = new AudioContext();
    await resumeAudio(context);
    usePreferences.setState({
      soundEnabled: true,
      soundError: null,
      soundErrorDetail: null,
    });
  } catch (error) {
    reportSoundError(error);
  }
}

export const ENGINE_REV_SECONDS = 0.72;

// Two "vroom" revs: detuned sawtooth/square engine voices with a rumbling tremolo.
function playEngineRev(audio: AudioContext): void {
  const now = audio.currentTime;
  const end = now + ENGINE_REV_SECONDS;
  const master = audio.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.11, now + 0.05);
  master.gain.setValueAtTime(0.11, end - 0.18);
  master.gain.exponentialRampToValueAtTime(0.0001, end);
  const tremolo = audio.createGain();
  tremolo.gain.setValueAtTime(0.65, now);
  const filter = audio.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.setValueAtTime(6, now);
  filter.frequency.setValueAtTime(380, now);
  filter.frequency.linearRampToValueAtTime(1500, now + 0.3);
  filter.frequency.linearRampToValueAtTime(600, now + 0.38);
  filter.frequency.linearRampToValueAtTime(1800, end - 0.06);
  filter.connect(tremolo);
  tremolo.connect(master);
  master.connect(audio.destination);

  const lfo = audio.createOscillator();
  const lfoDepth = audio.createGain();
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(22, now);
  lfo.frequency.linearRampToValueAtTime(48, end);
  lfoDepth.gain.setValueAtTime(0.35, now);
  lfo.connect(lfoDepth);
  lfoDepth.connect(tremolo.gain);

  const voices = (
    [
      ['sawtooth', 1],
      ['square', 0.502],
    ] as const
  ).map(([type, ratio]) => {
    const voice = audio.createOscillator();
    voice.type = type;
    voice.frequency.setValueAtTime(60 * ratio, now);
    voice.frequency.exponentialRampToValueAtTime(165 * ratio, now + 0.3);
    voice.frequency.exponentialRampToValueAtTime(90 * ratio, now + 0.38);
    voice.frequency.exponentialRampToValueAtTime(210 * ratio, end);
    voice.connect(filter);
    return voice;
  });
  const sources = [lfo, ...voices];
  voices[0].onended = () => {
    for (const node of [...sources, lfoDepth, filter, tremolo, master])
      node.disconnect();
  };
  for (const source of sources) {
    source.start(now);
    source.stop(end);
  }
}

export function playEventSound(event: GameEvent): void {
  if (!usePreferences.getState().soundEnabled || !context) return;
  const audio = context;
  if (audio.state !== 'running') {
    void resumeAudio(audio)
      .then(() => {
        if (usePreferences.getState().soundEnabled) playEventSound(event);
      })
      .catch(reportSoundError);
    return;
  }
  if (event.type === 'DICE_ROLLED') {
    try {
      playEngineRev(audio);
    } catch (error) {
      reportSoundError(error);
    }
    return;
  }
  const notes: Partial<Record<GameEvent['type'], readonly number[]>> = {
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
    reportSoundError(error);
  }
}
