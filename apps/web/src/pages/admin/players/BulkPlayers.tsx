import { useState, type ChangeEvent, type FormEvent } from 'react';
import { bulkCreatePlayers, type BulkResult } from '../../../api/admin';
import { useApiMutation } from '../../../api/mutation';
import { FormError } from '../../../components/FormError';

const EXAMPLE = `[
  { "nome": "João Silva", "celular": "+55 84 99677-3612", "time": "LEO" },
  { "nome": "Pedro Costa", "celular": "+351 912 345 678" }
]`;

/** Lê o texto como lista de jogadores; devolve a lista ou a mensagem do que está errado. */
function readList(text: string): unknown[] | string {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return 'O texto não é um JSON válido. Confira vírgulas, aspas e colchetes.';
  }
  if (!Array.isArray(data) || data.length === 0) return 'O JSON precisa ser uma lista de jogadores, entre [ e ], com pelo menos um item.';
  if (data.length > 200) return 'Envie no máximo 200 jogadores por vez.';
  return data;
}

const plural = (count: number) => (count === 1 ? '1 jogador cadastrado.' : `${count} jogadores cadastrados.`);

/** Cadastro de vários jogadores colando um JSON ou escolhendo um arquivo. Salva os válidos e lista os que falharam. */
export function BulkPlayers() {
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);
  const send = useApiMutation(bulkCreatePlayers);

  const loadFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result ?? ''));
      setProblem(null);
      setResult(null);
    };
    reader.onerror = () => setProblem('Não foi possível ler o arquivo.');
    reader.readAsText(file);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setResult(null);
    const list = readList(text);
    if (typeof list === 'string') {
      setProblem(list);
      return;
    }
    setProblem(null);
    send.mutate(list, {
      onSuccess: (data) => {
        setResult(data);
        if (data.failed.length === 0) setText('');
      },
    });
  };

  return (
    <>
      <h2>Cadastrar em massa</h2>
      <form className="form bulk-form" aria-label="Cadastrar em massa" onSubmit={submit}>
        <p className="muted">
          Cole uma lista em JSON com nome, celular (com o código do país) e, se quiser, o time (tag ou nome). Os jogadores
          válidos são salvos; os que tiverem problema aparecem abaixo para corrigir.
        </p>
        <pre className="code-sample">{EXAMPLE}</pre>
        <label className="field">
          <span>JSON dos jogadores</span>
          <textarea
            rows={8}
            spellCheck={false}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setProblem(null);
            }}
          />
        </label>
        <label className="field">
          <span>Ou escolha um arquivo .json</span>
          <input type="file" accept=".json,application/json" onChange={loadFile} />
        </label>
        {problem && (
          <p className="state state-error" role="alert">
            {problem}
          </p>
        )}
        <FormError error={send.error} />
        {result && (
          <div className="bulk-result">
            <p className="notice" role="status">
              {plural(result.created.length)}
              {result.failed.length > 0 && ` ${result.failed.length} com problema.`}
            </p>
            {result.failed.length > 0 && (
              <ul className="issue-list" aria-label="Cadastros que falharam">
                {result.failed.map((failure) => (
                  <li key={failure.line}>
                    Linha {failure.line}
                    {failure.name ? ` (${failure.name})` : ''}: {failure.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="actions">
          <button type="submit" className="button" disabled={send.isPending || text.trim() === ''}>
            Cadastrar jogadores
          </button>
        </div>
      </form>
    </>
  );
}
