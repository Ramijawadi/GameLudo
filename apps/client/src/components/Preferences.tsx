import { useEffect } from 'react';
import { usePreferences, useTranslation } from '../i18n';
import { toggleSound } from '../sounds';

export function Preferences() {
  const { language, t } = useTranslation();
  const setLanguage = usePreferences((state) => state.setLanguage);
  const sound = usePreferences((state) => state.soundEnabled);
  const error = usePreferences((state) => state.soundError);
  const detail = usePreferences((state) => state.soundErrorDetail);
  useEffect(() => {
    document.documentElement.lang = language === 'tn' ? 'aeb-Latn' : language;
  }, [language]);
  return (
    <div className="preferences">
      <label>
        <span className="sr-only">{t('language')}</span>
        <select
          value={language}
          onChange={(event) => {
            const value = event.target.value;
            if (value !== 'en' && value !== 'fr' && value !== 'tn')
              throw new Error('Unknown language.');
            setLanguage(value);
          }}
        >
          <option value="en">EN</option>
          <option value="fr">FR</option>
          <option value="tn">TN</option>
        </select>
      </label>
      <button
        type="button"
        className="sound-toggle"
        aria-pressed={sound}
        title={t(sound ? 'soundOn' : 'soundOff')}
        onClick={() => {
          void toggleSound();
        }}
      >
        <span aria-hidden="true">{sound ? '🔊' : '🔇'}</span>
        <span className="pref-label">{t(sound ? 'soundOn' : 'soundOff')}</span>
      </button>
      {error && (
        <span className="pref-error" role="alert">
          {t(error)}
          {detail ? ` (${detail})` : ''}
        </span>
      )}
    </div>
  );
}
