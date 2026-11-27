import { DestroyRef, computed, inject } from '@angular/core';
import { API_MAX_PAGE_SIZE, lookupCompleto } from '@uniplus/shared-core/http';
import { UnidadesApi } from '@uniplus/shared-data/organizacao';

/** O tipo do escopo como a API devolve: o rótulo é o que a tela mostra quando não há unidade. */
interface TipoDoEscopo {
  readonly rotulo: string;
}

function catalogoDeUnidades() {
  const api = inject(UnidadesApi);
  const unidades = lookupCompleto(
    (cursor) => api.listar({ cursor, direction: 'next', limit: API_MAX_PAGE_SIZE }),
    inject(DestroyRef),
  );
  unidades.recarregar();
  const porId = computed(
    () => new Map(unidades.opcoes().map((u) => [u.id, u.sigla || u.nome] as const)),
  );
  return { unidades, porId };
}

/** Catálogo de unidades para nomear o escopo das concessões e dos pedidos. */
export function nomesDeEscopo() {
  const { unidades, porId } = catalogoDeUnidades();
  const nomeDe = (unidadeId: string | null, tipo: TipoDoEscopo): string =>
    unidadeId === null ? tipo.rotulo : porId().get(unidadeId) || 'Unidade não identificada';

  return {
    unidades,
    nome: (e: { readonly unidadeId: string | null; readonly tipo: TipoDoEscopo }) =>
      nomeDe(e.unidadeId, e.tipo),
    nomeDoItem: (i: { readonly unidadeId: string | null; readonly escopoTipo: TipoDoEscopo }) =>
      nomeDe(i.unidadeId, i.escopoTipo),
  };
}
