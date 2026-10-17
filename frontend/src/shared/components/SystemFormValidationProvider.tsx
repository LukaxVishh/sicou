import { useEffect, type ReactNode } from 'react';
import { useSystemDialog } from './SystemDialogProvider';

function getFieldMessage(field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  const label = field.labels?.[0]?.textContent?.replace(/\*/g, '').trim()
    || field.getAttribute('aria-label')
    || field.getAttribute('placeholder');
  const prefix = label ? `${label}: ` : '';
  const { validity } = field;

  if (validity.valueMissing) return `${prefix}preencha este campo.`;
  if (validity.typeMismatch && field instanceof HTMLInputElement) {
    if (field.type === 'email') return `${prefix}informe um e-mail válido.`;
    if (field.type === 'url') return `${prefix}informe um endereço válido.`;
  }
  if (validity.tooShort && field instanceof HTMLInputElement) return `${prefix}informe pelo menos ${field.minLength} caracteres.`;
  if (validity.tooLong && field instanceof HTMLInputElement) return `${prefix}use no máximo ${field.maxLength} caracteres.`;
  if (validity.rangeUnderflow && field instanceof HTMLInputElement) return `${prefix}o valor mínimo é ${field.min}.`;
  if (validity.rangeOverflow && field instanceof HTMLInputElement) return `${prefix}o valor máximo é ${field.max}.`;
  if (validity.patternMismatch) return `${prefix}o formato informado não é válido.`;
  return `${prefix}revise o valor informado.`;
}

export function SystemFormValidationProvider({ children }: { children: ReactNode }) {
  const { showAlert } = useSystemDialog();

  useEffect(() => {
    const formsWithPendingInvalidEvent = new WeakSet<HTMLFormElement>();

    function handleInvalid(event: Event) {
      const field = event.target;
      if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement)) return;
      event.preventDefault();

      field.setAttribute('aria-invalid', 'true');
      let focusTarget: HTMLElement = field;
      if (field instanceof HTMLSelectElement) {
        const visibleSelect = field.closest('label')?.querySelector<HTMLElement>('button[aria-haspopup="listbox"]');
        if (visibleSelect) {
          visibleSelect.setAttribute('aria-invalid', 'true');
          focusTarget = visibleSelect;
        }
      }

      const form = field.form;
      if (form && formsWithPendingInvalidEvent.has(form)) return;
      if (form) {
        formsWithPendingInvalidEvent.add(form);
        queueMicrotask(() => formsWithPendingInvalidEvent.delete(form));
      }

      focusTarget.focus();
      void showAlert(getFieldMessage(field), { title: 'Revise os campos', tone: 'danger' });
    }

    function clearInvalid(event: Event) {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
        if (target.validity.valid) target.removeAttribute('aria-invalid');
      }
      if (target instanceof HTMLElement && target.matches('button[aria-haspopup="listbox"]')) {
        queueMicrotask(() => {
          const select = target.closest('label')?.querySelector('select');
          if (select?.validity.valid) {
            select.removeAttribute('aria-invalid');
            target.removeAttribute('aria-invalid');
          }
        });
      }
    }

    document.addEventListener('invalid', handleInvalid, true);
    document.addEventListener('input', clearInvalid, true);
    document.addEventListener('change', clearInvalid, true);
    document.addEventListener('click', clearInvalid, true);
    return () => {
      document.removeEventListener('invalid', handleInvalid, true);
      document.removeEventListener('input', clearInvalid, true);
      document.removeEventListener('change', clearInvalid, true);
      document.removeEventListener('click', clearInvalid, true);
    };
  }, [showAlert]);

  return children;
}
