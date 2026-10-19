/** Caminho interno (`/algo`), sem truques para sair do site. */
export function isSafePath(target: string | null): target is string {
  return !!target && target.startsWith('/') && !target.startsWith('//') && !target.includes('\\') && !/[\u0000-\u001f\u007f]/.test(target);
}

/** Só aceita caminhos internos (`/algo`); qualquer outro destino volta para o admin. */
export function safeRedirect(target: string | null): string {
  return isSafePath(target) ? target : '/admin';
}

const isAdminPath = (path: string) => /^\/admin(?:[/?#]|$)/.test(path);

/** Destino depois de entrar: organizador vai para o pedido (ou o admin); usuário comum nunca vai para o admin. */
export function afterSignIn(user: { role: string }, target: string | null): string {
  if (user.role === 'admin') return safeRedirect(target);
  return isSafePath(target) && !isAdminPath(target) ? target : '/';
}
