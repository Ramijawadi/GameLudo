import { useEffect, useRef } from 'react';
import { useTranslation } from '../i18n';

export function ResetDialog({
  onReset,
  onClose,
}: {
  onReset(): void;
  onClose(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { t } = useTranslation();
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    return () => element.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="reset-dialog"
      aria-labelledby="reset-title"
      onCancel={onClose}
    >
      <h2 id="reset-title">{t('restart')}</h2>
      <p>{t('lost')}</p>
      <button type="button" className="primary" onClick={onReset}>
        {t('end')}
      </button>
      <button type="button" className="text-button" autoFocus onClick={onClose}>
        {t('keep')}
      </button>
    </dialog>
  );
}
