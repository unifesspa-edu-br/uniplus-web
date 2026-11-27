/**
 * Entrar de novo, no fim do período máximo da sessão, encerra a sessão no provedor e começa outra.
 * A rota de volta segue na URL de retorno do encerramento, com este parâmetro, que a partida da
 * aplicação lê e retira; nada é guardado no navegador.
 */
export const PARAMETRO_ENTRAR_DE_NOVO = 'entrarDeNovo';

/**
 * A URL para onde o provedor devolve a pessoa depois de encerrar a sessão. O provedor só aceita
 * o retorno dentro do prefixo da aplicação (`/portal/*`): a raiz leva a barra final (`/portal/`).
 */
export function urlDeRetornoParaEntrarDeNovo(rota: string, base: string): string {
  const baseDaAplicacao = new URL(base);
  const url = new URL(rota.replace(/^\//, ''), baseDaAplicacao);
  if (url.pathname === baseDaAplicacao.pathname.replace(/\/$/, '')) url.pathname += '/';
  url.searchParams.set(PARAMETRO_ENTRAR_DE_NOVO, '1');
  return url.href;
}

/** A mesma URL sem o parâmetro, ou `null` quando ela não veio de entrar de novo. */
export function urlSemOParametroDeEntrarDeNovo(href: string): string | null {
  const url = new URL(href);
  if (!url.searchParams.has(PARAMETRO_ENTRAR_DE_NOVO)) return null;
  url.searchParams.delete(PARAMETRO_ENTRAR_DE_NOVO);
  return url.href;
}
