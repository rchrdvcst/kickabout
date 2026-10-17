import { ApiError } from '../api/client';

interface Issue {
  message: string;
}

const isIssue = (value: unknown): value is Issue =>
  typeof value === 'object' && value !== null && typeof (value as Issue).message === 'string';

/** Erro de uma escrita: mensagem da API e, no resultado, a lista de regras quebradas (já em português). */
export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  const apiError = error instanceof ApiError ? error : null;
  const issues =
    apiError?.code === 'INVALID_RESULT' && Array.isArray(apiError.details)
      ? [...new Set((apiError.details as unknown[]).filter(isIssue).map((issue) => issue.message))]
      : [];
  return (
    <div className="state state-error" role="alert">
      <p>{apiError?.message ?? 'Não foi possível salvar. Tente de novo.'}</p>
      {issues.length > 0 && (
        <ul className="issue-list">
          {issues.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
