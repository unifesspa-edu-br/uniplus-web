import type { Page, Route } from '@playwright/test';
import { pedidoSeed, UNIDADE_ID } from './api-de-acesso/modelo';
import { subDe } from './api-de-acesso/resposta';
import {
  CORS_HEADERS,
  mockUnidades,
  problema,
  responder,
  type Resposta,
} from './api-de-perfis-filas';

export const PERFIL_SENSIVEL_ID = '01960000-0000-7000-0000-00000000bb02';
export const PEDIDO_ID = '01960000-0000-7000-0000-00000000cc21';
const FERNANDA = { emissor: 'unifesspa', sub: 'sub-fernanda-0001-ficticia' };

/** O perfil com dado sensível exige o termo; o comum não. */
const PERFIS_PARA_PEDIDO = [
  {
    id: PERFIL_SENSIVEL_ID,
    nome: 'Analista de documentos',
    descricao: 'Analisa os documentos pessoais do processo.',
    escopo: 'unidade',
    exigeAprovacaoDeProtecaoDeDados: true,
    governanca: null,
  },
];

const PARAGRAFO =
  'Declaro que tratarei os dados pessoais acessados apenas para a finalidade do processo seletivo, ' +
  'guardarei sigilo sobre eles e comunicarei qualquer incidente à gestão de acessos. ';

/** Uma versão do termo; a de número maior é a vigente, salvo indicação. */
export function versaoDoTermo(numero: number, parcial: object = {}) {
  return {
    id: `termo-v${numero}`,
    numero,
    texto: `Versão ${numero}. Compromisso próprio da versão ${numero} do termo. ${PARAGRAFO.repeat(2)}`,
    resumo: String(numero).repeat(64),
    ato: `Portaria ${numero}/2026`,
    publicadaEm: `2026-0${numero}-01T12:00:00Z`,
    vigente: true,
    ...parcial,
  };
}

export const SEM_TERMO: Resposta = {
  status: 404,
  corpo: problema(
    404,
    'uniplus.autorizacao.termo.sem_versao_vigente',
    'Não há termo de responsabilidade publicado',
  ),
};

/** As respostas em sequência de cada rota; a última se repete. */
export interface CenarioDoTermo {
  readonly vigente?: readonly Resposta[];
  readonly historico?: readonly object[];
  readonly publicacao?: readonly Resposta[];
  readonly criacao?: readonly Resposta[];
  readonly pedido?: (sub: string) => object;
  readonly aceite?: Resposta;
}

export interface ChamadaDoTermo {
  readonly metodo: string;
  readonly caminho: string;
  readonly corpo: unknown;
  readonly chave: string | undefined;
}

export interface OpcoesDoPedido {
  readonly solicitadoPorMim: boolean;
  readonly anexaraDocumento: boolean;
  readonly situacao?: string;
  readonly termo?: object | null;
}

function partesDoPedido(opcoes: OpcoesDoPedido, sub: string) {
  const eu = { emissor: 'unifesspa', sub };
  return {
    solicitante: opcoes.solicitadoPorMim ? eu : FERNANDA,
    beneficiario: { email: 'quem.le@unifesspa.edu.br', identidade: eu, nome: 'Quem lê' },
  };
}

/** O pedido de perfil sensível em que quem lê é o beneficiário, com o termo fixado na versão 1. */
export function pedidoComTermo(opcoes: OpcoesDoPedido) {
  return (sub: string) => ({
    ...pedidoSeed({
      id: PEDIDO_ID,
      situacao: opcoes.situacao ?? 'aguardando_beneficiario',
      etapaAtual: null,
      ...partesDoPedido(opcoes, sub),
    }),
    anexaraDocumento: opcoes.anexaraDocumento,
    termo: opcoes.termo === undefined ? termoFixado() : opcoes.termo,
  });
}

function termoFixado() {
  const { id, numero, resumo } = versaoDoTermo(1);
  return { versaoId: id, numero, resumo, aceite: null };
}

const RESPOSTAS_PADRAO = {
  vigente: [{ status: 200, corpo: versaoDoTermo(2) }],
  criacao: [{ status: 201, corpo: { id: PEDIDO_ID } }],
  aceite: { status: 200, corpo: { id: PEDIDO_ID } },
} as const;

function emSequencia(respostas: readonly Resposta[], vezes: Map<string, number>, rota: string) {
  const vez = vezes.get(rota) ?? 0;
  vezes.set(rota, vez + 1);
  return respostas[Math.min(vez, respostas.length - 1)] as Resposta;
}

function historico(cenario: CenarioDoTermo): Resposta {
  return {
    status: 200,
    corpo: cenario.historico ?? [versaoDoTermo(1, { vigente: false }), versaoDoTermo(2)],
  };
}

function versaoPeloId(caminho: string): Resposta {
  const numero = Number(caminho.split('termo-v').at(-1));
  return { status: 200, corpo: versaoDoTermo(numero, { vigente: false }) };
}

type Atendimento = (cenario: CenarioDoTermo, route: Route, vezes: Map<string, number>) => Resposta;

/** O que cada rota responde, pela ordem: a primeira cujo padrão casa com "MÉTODO caminho". */
const ATENDIMENTOS: readonly (readonly [RegExp, Atendimento])[] = [
  [
    /^GET .*\/vigente$/u,
    (c, _, v) => emSequencia(c.vigente ?? RESPOSTAS_PADRAO.vigente, v, 'vigente'),
  ],
  [/^GET .*\/versoes\/[^/]+$/u, (_, r) => versaoPeloId(new URL(r.request().url()).pathname)],
  [/^GET .*\/versoes$/u, (c) => historico(c)],
  [
    /^POST .*\/versoes$/u,
    (c, _, v) =>
      emSequencia(c.publicacao ?? [{ status: 201, corpo: versaoDoTermo(3) }], v, 'publicacao'),
  ],
  [/^GET .*\/perfis-para-pedido$/u, () => ({ status: 200, corpo: PERFIS_PARA_PEDIDO })],
  [
    /^POST .*\/pedidos-de-concessao$/u,
    (c, _, v) => emSequencia(c.criacao ?? RESPOSTAS_PADRAO.criacao, v, 'criacao'),
  ],
  [/^POST .*\/aceite$/u, (c) => c.aceite ?? RESPOSTAS_PADRAO.aceite],
  [/^GET .*\/trilha$/u, () => ({ status: 200, corpo: [] })],
  [/^GET .*\/pedidos-de-concessao\/[^/]+$/u, (c, r) => pedidoLido(c, r)],
];

function pedidoLido(cenario: CenarioDoTermo, route: Route): Resposta {
  const pedido =
    cenario.pedido ??
    pedidoComTermo({ solicitadoPorMim: true, anexaraDocumento: false, termo: null });
  return { status: 200, corpo: pedido(subDe(route)) };
}

function registrar(route: Route, chamadas: ChamadaDoTermo[]): string {
  const requisicao = route.request();
  const caminho = new URL(requisicao.url()).pathname;
  chamadas.push({
    metodo: requisicao.method(),
    caminho,
    corpo: requisicao.postData() === null ? null : requisicao.postDataJSON(),
    chave: requisicao.headers()['idempotency-key'],
  });
  return `${requisicao.method()} ${caminho}`;
}

const ROTAS_DO_TERMO =
  /\/api\/autorizacao\/(termos-de-responsabilidade|pedidos-de-concessao|perfis-para-pedido)/u;

function atender(cenario: CenarioDoTermo, chamadas: ChamadaDoTermo[], vezes: Map<string, number>) {
  return (route: Route): Promise<void> => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: CORS_HEADERS });
    const chave = registrar(route, chamadas);
    const atendimento = ATENDIMENTOS.find(([padrao]) => padrao.test(chave));
    return atendimento ? responder(route, atendimento[1](cenario, route, vezes)) : route.fallback();
  };
}

/**
 * Simula as rotas do termo de responsabilidade, a criação, a leitura e o aceite do pedido e os
 * perfis que se podem pedir. Devolve as chamadas recebidas, com o corpo e a Idempotency-Key.
 */
export async function mockApiDoTermo(
  page: Page,
  cenario: CenarioDoTermo = {},
): Promise<ChamadaDoTermo[]> {
  const chamadas: ChamadaDoTermo[] = [];
  await mockUnidades(page);
  await page.route(ROTAS_DO_TERMO, atender(cenario, chamadas, new Map()));
  return chamadas;
}

export { UNIDADE_ID };
