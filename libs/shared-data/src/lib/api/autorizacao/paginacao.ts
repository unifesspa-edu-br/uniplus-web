import { janelaDaPagina, paramsDosFiltros } from '@uniplus/shared-core/http';

/** Janela de uma listagem paginada por cursor opaco (ADR-0026). */
export interface PaginaQuery {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
}

const LIMITE_PADRAO = 50;

/** Parâmetros de cursor: com cursor segue a página pedida, sem ele abre a primeira. */
export function paramsDaPagina(query: PaginaQuery, filtros: Record<string, string | undefined>) {
  return janelaDaPagina(paramsDosFiltros(filtros), query, LIMITE_PADRAO);
}
