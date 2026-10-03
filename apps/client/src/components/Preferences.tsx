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
        aria-pressed={sound}
        onClick={() => {
          void toggleSound();
        }}
      >
        {t(sound ? 'soundOn' : 'soundOff')}
      </button>
      {error && (
        <span role="alert">
          {t(error)}
          {detail ? ` (${detail})` : ''}
        </span>
      )}
    </div>
  );
}
