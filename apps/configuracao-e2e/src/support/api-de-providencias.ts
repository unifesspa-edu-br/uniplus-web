import type { Page } from '@playwright/test';
import {
  mockRota,
  mockUnidades,
  problema,
  UNIDADE_CEPS,
  type Chamada,
  type Resposta,
} from './api-de-perfis-filas';

/** A API simulada das providências sobre concessões e da concessão de onde a solicitação parte. */

const EMISSOR = 'https://sso.unifesspa.edu.br/realms/unifesspa';
const pessoa = (sub: string, nome: string) => ({ emissor: EMISSOR, sub, nome });

export const PROVIDENCIA_ID = '01960000-0000-7000-0000-0000000000e1';
export const CONCESSAO_ID = '01960000-0000-7000-0000-0000000000c1';
const RAIZ = '\\/api\\/autorizacao';

const CONCESSAO = {
  id: CONCESSAO_ID,
  beneficiario: pessoa('sub-leandro', 'Leandro Caleb Viana'),
  perfil: { id: 'p1', nome: 'Banca de documentos' },
  escopo: { tipo: 'unidade', unidadeId: UNIDADE_CEPS },
  validaAte: null,
  ativa: true,
};

/** A providência aberta do Kevin sobre a concessão do Leandro. */
export function providencia(parcial: object = {}) {
  return {
    id: PROVIDENCIA_ID,
    tipo: 'retirada',
    fundamento: 'Deixou a banca e mantém acesso a documentos sensíveis.',
    situacao: 'aberta',
    abertaEm: '2026-11-10T12:00:00Z',
    solicitadaPor: pessoa('sub-kevin', 'Kevin Anderson Carvalho'),
    concessao: CONCESSAO,
    encerramentoDaConcessao: null,
    desfecho: null,
    impedidoDeResponder: false,
    ...parcial,
  };
}

export const CONFLITO_RETENTAVEL = {
  ...problema(409, 'uniplus.concorrencia.conflito', 'Conflito'),
  retryable: true,
};

/** A concessão completa, como a leitura do detalhe dela a devolve. */
const CONCESSAO_LIDA = {
  ...CONCESSAO,
  versao: 1,
  origem: { tipo: 'pedido', id: 'pd1' },
  concedidaEm: '2026-03-02T12:00:00Z',
  revogadaEm: null,
  revogadaPor: null,
  revogadaPelaJanelaId: null,
  motivoRevogacao: null,
};

export interface CenarioDasProvidencias {
  /** As leituras do detalhe, em sequência; a última se repete. */
  readonly detalhe?: readonly object[];
  /** As respostas das escritas, em sequência; a última se repete. */
  readonly escritas?: readonly Resposta[];
}

const emSequencia = <T>(lista: readonly T[], numero: number): T =>
  lista[Math.min(numero, lista.length) - 1] as T;

/** A concessão de onde a solicitação parte, com a trilha vazia. */
async function mockConcessao(page: Page): Promise<void> {
  await mockUnidades(page);
  await mockRota(page, new RegExp(`${RAIZ}\\/concessoes\\/[^/?]+(\\/trilha)?$`), (c) => ({
    status: 200,
    corpo: c.caminho.endsWith('/trilha') ? [] : CONCESSAO_LIDA,
  }));
}

/** O detalhe da providência, com as leituras em sequência. */
async function mockDetalhe(page: Page, detalhe: readonly object[]): Promise<void> {
  await mockRota(page, new RegExp(`${RAIZ}\\/providencias\\/[^/?]+$`), (_c, n) => ({
    status: 200,
    corpo: emSequencia(detalhe, n),
  }));
}

/** A fila e as escritas: a solicitação, a resposta e o atendimento, em sequência. */
async function mockFilaEEscritas(page: Page, escritas: readonly Resposta[]): Promise<Chamada[]> {
  const recebidas: Chamada[] = [];
  const escrever = (chamada: Chamada): Resposta => {
    recebidas.push(chamada);
    return emSequencia(escritas, recebidas.length);
  };
  await mockRota(page, new RegExp(`${RAIZ}\\/providencias(\\?.*)?$`), (c) =>
    c.metodo === 'GET' ? { status: 200, corpo: [providencia()] } : escrever(c),
  );
  const rotaDasEscritas = new RegExp(`${RAIZ}\\/providencias\\/[^/?]+\\/(resposta|atendimento)$`);
  await mockRota(page, rotaDasEscritas, escrever);
  return recebidas;
}

/** Instala a API simulada e devolve as escritas recebidas. */
export async function mockProvidencias(
  page: Page,
  cenario: CenarioDasProvidencias = {},
): Promise<Chamada[]> {
  const { detalhe = [providencia()], escritas = [{ status: 200, corpo: providencia() }] } = cenario;
  await mockConcessao(page);
  await mockDetalhe(page, detalhe);
  return mockFilaEEscritas(page, escritas);
}
