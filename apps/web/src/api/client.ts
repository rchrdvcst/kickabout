export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

const GENERIC_MESSAGE = 'Não foi possível falar com o servidor. Tente de novo em instantes.';

function parseJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function apiRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = parseJson(await response.text()) as { error?: { code?: string; message?: string; details?: unknown } } | null;
  if (!response.ok) {
    const error = data?.error;
    throw new ApiError(response.status, error?.code ?? 'HTTP_ERROR', error?.message ?? GENERIC_MESSAGE, error?.details);
  }
  return data as T;
}

export const apiGet = <T>(path: string): Promise<T> => apiRequest<T>('GET', path);
