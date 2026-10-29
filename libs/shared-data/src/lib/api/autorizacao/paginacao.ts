import { HttpParams } from '@angular/common/http';

/** Janela de uma listagem paginada por cursor opaco (ADR-0026). */
export interface PaginaQuery {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
}

const LIMITE_PADRAO = 50;

/** Parâmetros de cursor: com cursor segue a página pedida, sem ele abre a primeira. */
export function paramsDaPagina(query: PaginaQuery, filtros: Record<string, string | undefined>) {
  let params = new HttpParams();
  for (const [nome, valor] of Object.entries(filtros)) {
    if (valor !== undefined) params = params.set(nome, valor);
  }
  return query.cursor !== undefined
    ? params.set('cursor', query.cursor).set('direction', query.direction ?? 'next')
    : params.set('limit', String(query.limit ?? LIMITE_PADRAO));
}
