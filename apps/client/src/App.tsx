import { useState } from 'react';
import { Board } from './components/Board';
import { Dice } from './components/Dice';
import { PlayerPanel } from './components/PlayerPanel';
import { ResetDialog } from './components/ResetDialog';
import { TurnBanner } from './components/TurnBanner';
import { SetupPage } from './SetupPage';
import { useGameStore } from './store';
import { useEventQueue } from './useEventQueue';
import { EventCardModal } from './components/EventCardModal';
import { Preferences } from './components/Preferences';
import { ReactionBar } from './components/ReactionBar';
import { localizeError, useTranslation } from './i18n';
import { tileRegistry } from '@ludo/engine';

export function App() {
  const game = useGameStore((state) => state.game);
  const error = useGameStore((state) => state.error);
  const reset = useGameStore((state) => state.reset);
  const [confirmReset, setConfirmReset] = useState(false);
  const { t, language } = useTranslation();
  useEventQueue();
  return (
    <>
      {error && (
        <div className="error" role="alert">
          {localizeError(language, error)}
        </div>
      )}
      {!game ? (
        <SetupPage />
      ) : (
        <main className="game-page">
          <header className="game-header">
            <h1>
              Ludo <span>{t('passPlay')}</span>
            </h1>
            <button
              type="button"
              className="text-button"
              onClick={() => setConfirmReset(true)}
            >
              {t('newGame')}
            </button>
          </header>
          <Preferences />
          <TurnBanner />
          <Board />
          <Dice />
          <PlayerPanel />
          <ReactionBar />
          <details className="rules">
            <summary>{t('quickRules')}</summary>
            <p>{t('rules')}</p>
            {game.mode === 'tunisian' && (
              <ul className="tile-legend">
                {tileRegistry.all().map((tile) => (
                  <li key={tile.id}>
                    <strong>{t(`tile_${tile.id}`)}</strong>{' '}
                    {t(`effect_${tile.id}`)}
                  </li>
                ))}
              </ul>
            )}
          </details>
        </main>
      )}
      <EventCardModal />
      {confirmReset && (
        <ResetDialog
          onReset={() => {
            reset();
            setConfirmReset(false);
          }}
          onClose={() => setConfirmReset(false)}
        />
      )}
    </>
  );
}
