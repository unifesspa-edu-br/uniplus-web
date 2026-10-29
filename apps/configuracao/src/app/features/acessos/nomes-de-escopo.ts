import { DestroyRef, computed, inject } from '@angular/core';
import { API_MAX_PAGE_SIZE, lookupCompleto } from '@uniplus/shared-core/http';
import { UnidadesApi } from '@uniplus/shared-data/organizacao';

/** Catálogo de unidades para nomear o escopo das concessões e dos pedidos. */
export function nomesDeEscopo() {
  const api = inject(UnidadesApi);
  const unidades = lookupCompleto(
    (cursor) => api.listar({ cursor, direction: 'next', limit: API_MAX_PAGE_SIZE }),
    inject(DestroyRef),
  );
  unidades.recarregar();

  const porId = computed(
    () =>
      new Map(
        unidades.opcoes().map((unidade) => [unidade.id, unidade.sigla || unidade.nome] as const),
      ),
  );

  return {
    unidades,
    nome: (escopo: { readonly unidadeId: string | null }): string =>
      escopo.unidadeId === null
        ? 'Instituição'
        : porId().get(escopo.unidadeId) || 'Unidade não identificada',
  };
}
