import { HttpParams } from '@angular/common/http';

/** Janela pedida a uma listagem paginada por cursor opaco (ADR-0026). */
export interface JanelaDaPagina {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
}

/** Tamanho da primeira página quando a tela não pede outro. */
export const LIMITE_PADRAO_DA_LISTAGEM = 100;

/**
 * Acrescenta a janela da página aos parâmetros: com cursor, segue a página pedida na direção
 * dada; sem cursor (ou com cursor vazio, que o servidor trata como defeito — ADR-0015), abre a
 * primeira página com o limite.
 */
export function janelaDaPagina(
  params: HttpParams,
  janela: JanelaDaPagina,
  limitePadrao = LIMITE_PADRAO_DA_LISTAGEM,
): HttpParams {
  return temCursor(janela)
    ? params.set('cursor', janela.cursor).set('direction', janela.direction ?? 'next')
    : params.set('limit', String(janela.limit ?? limitePadrao));
}

function temCursor(janela: JanelaDaPagina): janela is JanelaDaPagina & { readonly cursor: string } {
  return janela.cursor !== undefined && janela.cursor.length > 0;
}

/** Parâmetros de consulta a partir dos filtros informados; os ausentes (`undefined`) ficam de fora. */
export function paramsDosFiltros(
  filtros: Readonly<Record<string, string | undefined>>,
): HttpParams {
  let params = new HttpParams();
  for (const [nome, valor] of Object.entries(filtros)) {
    if (valor !== undefined) params = params.set(nome, valor);
  }
  return params;
}

/** Acrescenta a busca textual `q`; texto vazio ou só de espaços não é busca. */
export function comBusca(params: HttpParams, texto: string | undefined): HttpParams {
  const busca = texto?.trim();
  return busca ? params.set('q', busca) : params;
}

/**
 * Acrescenta a ordenação `sort` só quando a janela abre a primeira página: o cursor carrega a
 * ordenação assinada, e reenviá-la a cada página faria a assinatura divergir. Vale depois de
 * `janelaDaPagina`, que decide se há cursor.
 */
export function comOrdenacaoDaPrimeiraPagina(
  params: HttpParams,
  ordenacao: string | undefined,
): HttpParams {
  const sort = ordenacao?.trim();
  return sort && !params.has('cursor') ? params.set('sort', sort) : params;
}
