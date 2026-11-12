import type { Page, Route } from '@playwright/test';
import { subDe } from './api-de-acesso/resposta';
import {
  CORS_HEADERS,
  UNIDADE_CEPS,
  mockUnidades,
  responder,
  type Resposta,
} from './api-de-perfis-filas';

export const REVISAO_ID = '01960000-0000-7000-0000-0000000000b1';
const EMISSOR = 'unifesspa';

export const FERNANDA = {
  emissor: EMISSOR,
  sub: 'sub-fernanda-0001-ficticia',
  nome: 'Fernanda Drumond',
};
export const DIOGO = { emissor: EMISSOR, sub: 'sub-diogo-0003-ficticio', nome: 'Diogo Souza' };
const BETINA = { emissor: EMISSOR, sub: 'sub-betina-0002-ficticia', nome: 'Betina Neves' };

type Identidade = { readonly emissor: string; readonly sub: string; readonly nome: string };

const PENDENTE = {
  escopo: { tipo: 'unidade', unidadeId: UNIDADE_CEPS },
  validaAte: null,
  decide: 'representante-do-controlador',
  situacao: 'pendente',
  decididoPor: null,
  decididoEm: null,
  ehDoLeitor: false,
};

export function itemDaRevisao(id: string, beneficiario: Identidade, parcial: object = {}) {
  const perfil = { id: `perfil-${id}`, nome: 'Operador de inscrições' };
  return { ...PENDENTE, id, concessaoId: `concessao-${id}`, beneficiario, perfil, ...parcial };
}

export const ITEM_DECIDIDO = {
  situacao: 'confirmada',
  decididoPor: BETINA,
  decididoEm: '2026-11-10T13:00:00Z',
};

/**
 * Os itens da revisão aberta: dois da Fernanda (um já decidido), o do Diogo e o de quem lê, que a
 * API marca com `ehDoLeitor`.
 */
export function itensDaRevisao(subDeQuemLe: string) {
  return [
    itemDaRevisao('i1', FERNANDA),
    itemDaRevisao('i2', FERNANDA, {
      ...ITEM_DECIDIDO,
      perfil: { id: 'p2', nome: 'Avaliador de recursos' },
    }),
    itemDaRevisao('i3', DIOGO, { decide: 'gestor-de-acessos' }),
    itemDaRevisao(
      'i4',
      { emissor: EMISSOR, sub: subDeQuemLe, nome: 'Pessoa que lê a revisão' },
      { ehDoLeitor: true },
    ),
  ];
}

export const RESUMO_ABERTO = {
  id: REVISAO_ID,
  abertaEm: '2026-11-09T12:00:00Z',
  abertaPor: BETINA,
  situacao: 'em_andamento',
  totalDeItens: 4,
  pendentes: 3,
};

export function revisaoAberta(subDeQuemLe: string, parcial: object = {}) {
  return { ...RESUMO_ABERTO, itens: itensDaRevisao(subDeQuemLe), ...parcial };
}

export const RESUMO_ENCERRADO = {
  id: '01960000-0000-7000-0000-0000000000b0',
  abertaEm: '2026-05-04T12:00:00Z',
  abertaPor: BETINA,
  situacao: 'concluida',
  totalDeItens: 2,
  pendentes: 0,
};

/** O cenário que a API simulada atende: a lista e as leituras do detalhe em sequência, e as escritas. */
export interface CenarioDaRevisao {
  readonly lista?: readonly object[];
  readonly detalhe: readonly ((sub: string) => object)[];
  readonly decisao?: Resposta;
  readonly abertura?: Resposta;
}

export interface ChamadaDaRevisao {
  readonly metodo: string;
  readonly caminho: string;
  readonly consulta: URLSearchParams;
  readonly corpo: unknown;
}

function registrar(route: Route, chamadas: ChamadaDaRevisao[]): void {
  const requisicao = route.request();
  const corpo = requisicao.postData() === null ? null : requisicao.postDataJSON();
  const { pathname, searchParams } = new URL(requisicao.url());
  chamadas.push({ metodo: requisicao.method(), caminho: pathname, consulta: searchParams, corpo });
}

/** A API filtra a lista pela situação antes de paginar. */
function naSituacao(lista: readonly object[], situacao: string | null): readonly object[] {
  if (situacao === null) return lista;
  return lista.filter((r) => (r as { situacao?: string }).situacao === situacao);
}

function respostaDe(route: Route, cenario: CenarioDaRevisao, leituras: { vez: number }): Resposta {
  const { pathname, searchParams } = new URL(route.request().url());
  if (route.request().method() === 'POST') {
    return pathname.endsWith('/revisoes')
      ? (cenario.abertura ?? { status: 201, corpo: revisaoAberta(subDe(route)) })
      : (cenario.decisao ?? { status: 204 });
  }
  if (pathname.endsWith('/revisoes'))
    return { status: 200, corpo: naSituacao(cenario.lista ?? [], searchParams.get('situacao')) };
  const leitura = cenario.detalhe[Math.min(leituras.vez++, cenario.detalhe.length - 1)];
  return leitura ? { status: 200, corpo: leitura(subDe(route)) } : { status: 404 };
}

/** Atende `/api/autorizacao/revisoes` e as unidades do escopo; devolve as chamadas recebidas. */
export async function mockRevisoes(
  page: Page,
  cenario: CenarioDaRevisao,
): Promise<ChamadaDaRevisao[]> {
  const chamadas: ChamadaDaRevisao[] = [];
  const leituras = { vez: 0 };
  await mockUnidades(page);
  await page.route(/\/api\/autorizacao\/revisoes(\/[^?]*)?(\?.*)?$/u, async (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: CORS_HEADERS });
    registrar(route, chamadas);
    return responder(route, respostaDe(route, cenario, leituras));
  });
  return chamadas;
}

const CONCESSAO_DA_FERNANDA = {
  beneficiario: FERNANDA,
  perfil: { id: 'p2', nome: 'Avaliador de recursos' },
  versao: 1,
  escopo: { tipo: 'unidade', unidadeId: UNIDADE_CEPS },
  origem: { tipo: 'pedido', id: 'pedido-1' },
  concedidaEm: '2026-03-02T12:00:00Z',
  validaAte: null,
  ativa: false,
};

/** A concessão revogada na revisão, com o motivo, que a tela da concessão mostra. */
export function concessaoRevogada(id: string, motivo: string) {
  return {
    ...CONCESSAO_DA_FERNANDA,
    id,
    revogadaEm: '2026-11-10T13:00:00Z',
    revogadaPor: BETINA,
    revogadaPelaJanelaId: null,
    motivoRevogacao: motivo,
  };
}

/** Atende a leitura de uma concessão e da trilha dela. */
export async function mockConcessao(page: Page, concessao: { readonly id: string }): Promise<void> {
  await page.route(/\/api\/autorizacao\/concessoes\/[^/?]+(\/trilha)?(\?.*)?$/u, (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: CORS_HEADERS });
    const trilha = new URL(route.request().url()).pathname.endsWith('/trilha');
    return responder(route, { status: 200, corpo: trilha ? [] : concessao });
  });
}
