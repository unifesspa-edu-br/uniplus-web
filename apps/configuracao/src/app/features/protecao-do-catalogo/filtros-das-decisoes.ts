import type { Params, ParamMap } from '@angular/router';
import type { AtoDeDecisao, CadastroDoCatalogo } from '@uniplus/shared-data/configuracao';
import { DECISOES_FILTRAVEIS } from '../../shared/protecao-do-catalogo';

/** Os filtros da aba "Decisões", como a query string os guarda. */
export interface FiltrosDasDecisoes {
  readonly ato: readonly AtoDeDecisao[];
  readonly cadastro: CadastroDoCatalogo | null;
  /** AAAA-MM-DD, ou vazio. */
  readonly de: string;
  /** AAAA-MM-DD, ou vazio. */
  readonly ate: string;
  readonly busca: string;
  readonly minhas: boolean;
}

export const SEM_FILTROS: FiltrosDasDecisoes = {
  ato: [],
  cadastro: null,
  de: '',
  ate: '',
  busca: '',
  minhas: false,
};

/** As decisões na ordem em que os filtros as oferecem. */
export const ATOS_DE_DECISAO: readonly AtoDeDecisao[] = DECISOES_FILTRAVEIS.map(
  (opcao) => opcao.valor,
);

/** Os cadastros que o filtro oferece. */
export const CADASTROS: readonly CadastroDoCatalogo[] = ['TIPO_DOCUMENTO', 'FATO'];
const DATA = /^\d{4}-\d{2}-\d{2}$/u;

/** Lê os filtros da query string; o valor que o vocabulário não conhece é descartado. */
export function filtrosDaUrl(params: ParamMap): FiltrosDasDecisoes {
  const atos = new Set(params.getAll('ato'));
  const cadastro = params.get('cadastro');
  const data = (nome: string): string => {
    const valor = params.get(nome) ?? '';
    return DATA.test(valor) ? valor : '';
  };
  return {
    ato: ATOS_DE_DECISAO.filter((ato) => atos.has(ato)),
    cadastro: CADASTROS.find((valor) => valor === cadastro) ?? null,
    de: data('de'),
    ate: data('ate'),
    busca: params.get('busca')?.trim() ?? '',
    minhas: params.get('minhas') === 'true',
  };
}

/** Os parâmetros da URL: o filtro vazio sai como `null`, para a navegação o remover. */
export function paramsDosFiltros(filtros: FiltrosDasDecisoes): Params {
  return {
    ato: filtros.ato.length > 0 ? filtros.ato : null,
    cadastro: filtros.cadastro,
    de: filtros.de || null,
    ate: filtros.ate || null,
    busca: filtros.busca || null,
    minhas: filtros.minhas ? 'true' : null,
  };
}

/** O período em que a data final vem antes da inicial não devolve nada: a tela avisa em vez de pedir. */
export function periodoInvalido(filtros: FiltrosDasDecisoes): boolean {
  return filtros.de !== '' && filtros.ate !== '' && filtros.ate < filtros.de;
}
