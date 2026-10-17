import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ApiError } from '../api/client';

interface Props<T> {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
}

export function QueryState<T>({ query, children, isEmpty, empty }: Props<T>) {
  if (query.isPending) {
    return (
      <p className="state" role="status">
        Carregando…
      </p>
    );
  }
  if (query.isError) {
    const message = query.error instanceof ApiError ? query.error.message : 'Não foi possível carregar esta página.';
    return (
      <p className="state state-error" role="alert">
        {message}
      </p>
    );
  }
  if (isEmpty?.(query.data)) return <>{empty}</>;
  return <>{children(query.data)}</>;
}
