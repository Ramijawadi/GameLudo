import { useState } from 'react';
import type { PlayerColor } from '@ludo/engine';
import { useGameStore } from './store';
import { useTranslation } from './i18n';
import { Preferences } from './components/Preferences';

const playersByCount: Record<number, readonly PlayerColor[]> = {
  2: ['red', 'yellow'],
  3: ['red', 'green', 'yellow'],
  4: ['red', 'green', 'yellow', 'blue'],
};

export function SetupPage() {
  const [count, setCount] = useState(2);
  const [tunisian, setTunisian] = useState(false);
  const { t, playerName } = useTranslation();
  const start = useGameStore((state) => state.start);
  const players = playersByCount[count];
  return (
    <main className="setup-page">
      <Preferences />
      <div className="logo-mark" aria-hidden="true">
        <i className="red" />
        <i className="green" />
        <i className="blue" />
        <i className="yellow" />
      </div>
      <p className="eyebrow">{t('eyebrow')}</p>
      <h1>Ludo</h1>
      <p className="intro">{t('intro')}</p>
      <section className="setup-card" aria-labelledby="setup-title">
        <h2 id="setup-title">{t('local')}</h2>
        <p>{t('noAccounts')}</p>
        <fieldset>
          <legend>{t('howMany')}</legend>
          <div className="count-choices">
            {[2, 3, 4].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={count === value}
                onClick={() => setCount(value)}
              >
                {value}
                <span>{t('players')}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <div className="setup-players">
          {players.map((color) => (
            <span key={color} className={color}>
              <i className="color-dot" />
              {playerName(color)}
            </span>
          ))}
        </div>
        <label className={`mode-toggle ${tunisian ? 'enabled' : ''}`}>
          <input
            type="checkbox"
            checked={tunisian}
            onChange={(event) => setTunisian(event.target.checked)}
          />
          <span>
            <strong>{t('tunisian')}</strong>
            <small>{t('tunisianHint')}</small>
          </span>
          <span aria-hidden="true">🇹🇳</span>
        </label>
        <button
          className="primary"
          type="button"
          onClick={() => {
            const seed = crypto.getRandomValues(new Uint32Array(1))[0];
            start({ seed, players, mode: tunisian ? 'tunisian' : 'standard' });
          }}
        >
          {t('start')}
        </button>
      </section>
      <p className="setup-note">{t('setupNote')}</p>
    </main>
  );
}
