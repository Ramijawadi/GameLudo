import { useState } from 'react';
import { Board } from './components/Board';
import { RollButton } from './components/Dice';
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
        <main className={`game-page ${game.mode}`}>
          <header className="game-header">
            <h1>
              Ludo <span>{t('passPlay')}</span>
            </h1>
            <Preferences />
            <details className="rules">
              <summary aria-label={t('quickRules')} title={t('quickRules')}>
                <span aria-hidden="true">?</span>
              </summary>
              <div className="rules-popover">
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
              </div>
            </details>
            <button
              type="button"
              className="icon-button"
              aria-label={t('newGame')}
              title={t('newGame')}
              onClick={() => setConfirmReset(true)}
            >
              <span aria-hidden="true">↺</span>
            </button>
          </header>
          <TurnBanner />
          <div className="board-area">
            <Board />
          </div>
          <RollButton />
          <PlayerPanel />
          <ReactionBar />
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
