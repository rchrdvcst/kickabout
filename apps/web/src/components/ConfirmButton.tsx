import { useState } from 'react';

interface Props {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
  danger?: boolean;
  /** Nome acessível do 1º botão, quando o rótulo visível se repete na página. */
  name?: string;
}

/** Ação irreversível em dois cliques, sem caixa de diálogo do navegador. */
export function ConfirmButton({ label, confirmLabel, onConfirm, disabled, danger, name }: Props) {
  const [asking, setAsking] = useState(false);
  const className = danger ? 'button button-danger' : 'button';
  if (!asking) {
    return (
      <button type="button" className={className} aria-label={name} disabled={disabled} onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <span className="confirm">
      <button
        type="button"
        className={className}
        disabled={disabled}
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </button>
      <button type="button" className="button button-secondary" onClick={() => setAsking(false)}>
        Cancelar
      </button>
    </span>
  );
}
