/** Só aceita caminhos internos (`/algo`); qualquer outro destino volta para o admin. */
export function safeRedirect(target: string | null): string {
  if (!target || !target.startsWith('/') || target.startsWith('//') || target.includes('\\') || /[\u0000-\u001f\u007f]/.test(target)) {
    return '/admin';
  }
  return target;
}
