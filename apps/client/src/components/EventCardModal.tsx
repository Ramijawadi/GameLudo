import { useEffect, useRef } from 'react';
import { useTranslation } from '../i18n';
import { useGameStore } from '../store';

export function EventCardModal() {
  const cardId = useGameStore((state) => state.activeCard);
  const game = useGameStore((state) => state.game);
  const dismiss = useGameStore((state) => state.dismissCard);
  const events = useGameStore((state) => state.eventQueue);
  const dialog = useRef<HTMLDialogElement>(null);
  const { t } = useTranslation();
  useEffect(() => {
    if (!cardId) return;
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, [cardId]);
  if (!cardId) return null;
  const targeting = game?.phase === 'CHOOSE_TARGET';
  const resolution = events.find(
    (event) => event.type === 'CARD_RESOLVED' && event.cardId === cardId,
  );
  const outcome =
    resolution?.type === 'CARD_RESOLVED'
      ? t(
          resolution.outcome === 'no_targets'
            ? 'noTargets'
            : resolution.outcome === 'no_effect'
              ? 'noEffect'
              : 'applied',
        )
      : '';
  return (
    <dialog
      ref={dialog}
      className="event-card-dialog"
      aria-labelledby="card-title"
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
    >
      <div className="card-stamp" aria-hidden="true">
        🇹🇳
      </div>
      <p className="eyebrow">{t('doubleSix')}</p>
      <h2 id="card-title">{t(`card_${cardId}`)}</h2>
      <p className="card-description">{t(`description_${cardId}`)}</p>
      <p className="card-outcome">{targeting ? t('chooseTarget') : outcome}</p>
      <button type="button" className="primary" autoFocus onClick={dismiss}>
        {t(targeting ? 'pickTarget' : 'continue')}
      </button>
    </dialog>
  );
}
