import type {
  ConcessaoDto,
  PedidoDeConcessaoDto,
  PerfilListadoDto,
} from '@uniplus/shared-data/autorizacao';
import type { JsonDaApi } from '@uniplus/shared-e2e';
import {
  classificacaoDeProtecao,
  etapaDoPedido,
  situacaoDoPedido,
  tipoDeEscopo,
  tipoDeOrigem,
} from '../enumerados-de-autorizacao';

/** O estado da API de autorização simulada: perfis oferecidos, pedidos, concessões e escritas. */

/** Pessoas fictícias do portal que aparecem como partes dos pedidos. */
export const FERNANDA = { emissor: 'unifesspa', contaId: 'conta-fernanda-0001-fictícia' };
export const BETINA_EMAIL = 'betina.teste@unifesspa.edu.br';

export const UNIDADE_ID = '01960000-0000-7000-0000-00000000aa01';
export const PERFIL_COMUM_ID = '01960000-0000-7000-0000-00000000bb01';
export const PERFIL_SENSIVEL_ID = '01960000-0000-7000-0000-00000000bb02';

const INTERNO = classificacaoDeProtecao('INTERNO');
const SENSIVEL = classificacaoDeProtecao('SENSIVEL');

type PerfilDaLista = JsonDaApi<PerfilListadoDto>;

const PERFIL_EM_VIGOR = {
  ativo: true,
  governanca: null,
  situacaoDoAcesso: { codigo: 'EM_VIGOR', rotulo: 'Em vigor' },
  temVersaoPendente: false,
  suspensao: null,
  desativadoDesde: null,
} as const satisfies Partial<PerfilDaLista>;

function perfil(id: string, nome: string, sensibilidade: PerfilDaLista['sensibilidade']) {
  return { ...PERFIL_EM_VIGOR, id, nome, descricao: `${nome}.`, sensibilidade };
}

export const PERFIS = [
  perfil(PERFIL_COMUM_ID, 'Operador de inscrições', INTERNO),
  perfil(PERFIL_SENSIVEL_ID, 'Analista de documentos', SENSIVEL),
];

type Modificavel<T> = { -readonly [Campo in keyof T]: T[Campo] };

/** O pedido e a concessão como a API os devolve; os testes mudam a situação deles no lugar. */
export type Pedido = Modificavel<JsonDaApi<PedidoDeConcessaoDto>>;
export type Concessao = Modificavel<JsonDaApi<ConcessaoDto>>;

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
  situacao: situacaoDoPedido('AGUARDANDO_GESTOR'),
  etapaAtual: etapaDoPedido('GESTOR'),
  solicitante: FERNANDA,
  beneficiario: {
    email: BETINA_EMAIL,
    identidade: { emissor: 'unifesspa', contaId: 'conta-betina-0002-fictícia' },
    nome: 'Betina Teste',
  },
  perfil: { id: PERFIL_SENSIVEL_ID, nome: 'Analista de documentos' },
  escopo: { tipo: tipoDeEscopo('UNIDADE'), unidadeId: UNIDADE_ID },
  justificativa: 'Analisa os documentos do processo seletivo da unidade.',
  criadoEm: '2026-10-28T12:00:00Z',
  encerradoEm: null,
  concessaoId: null,
  admitePrazo: true,
  validaAteSugerida: null,
  validaAte: null,
  versao: null,
  anexaraDocumento: false,
  termo: null,
} as const satisfies Partial<Pedido>;

/** Um pedido de perfil sensível na fila do gestor; as listas são novas a cada chamada. */
export function pedidoSeed(parcial: Partial<Pedido> = {}): Pedido {
  return {
    ...PEDIDO_NA_FILA_DO_GESTOR,
    anexos: [],
    decisoes: [],
    trocasDeVersao: [],
    ...parcial,
  };
}

const CONCESSAO_RECEM_CRIADA = {
  versao: 1,
  concedidaEm: '2026-10-29T10:00:00Z',
  revogadaEm: null,
  revogadaPor: null,
  revogadaPelaRevisaoId: null,
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
    origem: { tipo: tipoDeOrigem('PEDIDO'), id: pedido.id },
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
