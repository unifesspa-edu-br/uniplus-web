/** O estado da API de autorização simulada: perfis oferecidos, pedidos, concessões e escritas. */

/** Pessoas fictícias do portal que aparecem como partes dos pedidos. */
export const FERNANDA = { emissor: 'unifesspa', sub: 'sub-fernanda-0001-fictícia' };
export const BETINA_EMAIL = 'betina.teste@unifesspa.edu.br';

export const UNIDADE_ID = '01960000-0000-7000-0000-00000000aa01';
export const PERFIL_COMUM_ID = '01960000-0000-7000-0000-00000000bb01';
export const PERFIL_SENSIVEL_ID = '01960000-0000-7000-0000-00000000bb02';

function perfil(id: string, nome: string, sensibilidade: string) {
  return {
    id,
    nome,
    descricao: `${nome}.`,
    ativo: true,
    governanca: null,
    sensibilidade,
    temVersaoVigente: true,
    temVersaoPendente: false,
  };
}

export const PERFIS = [
  perfil(PERFIL_COMUM_ID, 'Operador de inscrições', 'interno'),
  perfil(PERFIL_SENSIVEL_ID, 'Analista de documentos', 'sensivel'),
];

type Identidade = { emissor: string; sub: string };

export interface Pedido {
  id: string;
  situacao: string;
  etapaAtual: string | null;
  solicitante: Identidade;
  beneficiario: { email: string; identidade: Identidade | null; nome: string | null };
  perfil: { id: string; nome: string };
  escopo: { tipo: string; unidadeId: string | null };
  justificativa: string;
  criadoEm: string;
  encerradoEm: string | null;
  concessaoId: string | null;
  anexos: unknown[];
  decisoes: unknown[];
  admitePrazo: boolean;
  validaAteSugerida: string | null;
  validaAte: string | null;
}

export interface Concessao {
  id: string;
  beneficiario: Identidade;
  perfil: { id: string; nome: string };
  versao: number | null;
  escopo: { tipo: string; unidadeId: string | null };
  origem: { tipo: string; id: string };
  concedidaEm: string;
  validaAte: string | null;
  revogadaEm: string | null;
  revogadaPor: null;
  motivoRevogacao: string | null;
  ativa: boolean;
}

/** O que a tela enviou à API, para os testes conferirem. */
export interface EstadoDaApi {
  pedidos: Pedido[];
  concessoes: Concessao[];
  criacoes: unknown[];
  recusas: unknown[];
  aprovacoes: unknown[];
  revogacoes: unknown[];
}

const PEDIDO_NA_FILA_DO_GESTOR = {
  id: '01960000-0000-7000-0000-00000000cc01',
  situacao: 'aguardando_gestor',
  etapaAtual: 'gestor',
  solicitante: FERNANDA,
  beneficiario: {
    email: BETINA_EMAIL,
    identidade: { emissor: 'unifesspa', sub: 'sub-betina-0002-fictícia' },
    nome: 'Betina Teste',
  },
  perfil: { id: PERFIL_SENSIVEL_ID, nome: 'Analista de documentos' },
  escopo: { tipo: 'unidade', unidadeId: UNIDADE_ID },
  justificativa: 'Analisa os documentos do processo seletivo da unidade.',
  criadoEm: '2026-10-28T12:00:00Z',
  encerradoEm: null,
  concessaoId: null,
  admitePrazo: true,
  validaAteSugerida: null,
  validaAte: null,
} as const satisfies Partial<Pedido>;

/** Um pedido de perfil sensível na fila do gestor; as listas são novas a cada chamada. */
export function pedidoSeed(parcial: Partial<Pedido> = {}): Pedido {
  return { ...PEDIDO_NA_FILA_DO_GESTOR, anexos: [], decisoes: [], ...parcial };
}

const CONCESSAO_RECEM_CRIADA = {
  versao: 1,
  concedidaEm: '2026-10-29T10:00:00Z',
  revogadaEm: null,
  revogadaPor: null,
  motivoRevogacao: null,
  ativa: true,
} as const;

/** A concessão ativa que a última aprovação de um pedido gera. */
export function concessaoDoPedido(pedido: Pedido, id: string): Concessao {
  return {
    ...CONCESSAO_RECEM_CRIADA,
    id,
    beneficiario: pedido.beneficiario.identidade ?? pedido.solicitante,
    perfil: pedido.perfil,
    escopo: pedido.escopo,
    origem: { tipo: 'pedido', id: pedido.id },
    validaAte: pedido.validaAte,
  };
}

/** O estado no início do teste: só os pedidos semeados, sem concessões nem escritas. */
export function estadoInicial(pedidos: readonly Pedido[]): EstadoDaApi {
  return {
    pedidos: [...pedidos],
    concessoes: [],
    criacoes: [],
    recusas: [],
    aprovacoes: [],
    revogacoes: [],
  };
}
