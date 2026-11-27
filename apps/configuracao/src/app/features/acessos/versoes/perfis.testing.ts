import {
  ClassificacaoDeProtecaoCodigo,
  EtapaDaVersaoCodigo,
  SituacaoDoAnexoCodigo,
} from '@uniplus/shared-data/autorizacao';
import type {
  PerfilDto,
  PermissaoDoPerfilDto,
  VersaoPendenteDto,
} from '@uniplus/shared-data/autorizacao';
import {
  ETAPA_GESTAO,
  ETAPA_PROTECAO,
  etapaDaVersao,
  sensibilidade,
  situacaoDoAnexo,
} from './enums-da-api.testing';
import { ACESSO_EM_VIGOR } from './situacao-do-acesso.testing';

export const LEITURA: PermissaoDoPerfilDto = {
  codigo: 'selecao:processos:consultar',
  nome: 'Consultar processos',
  sensibilidade: sensibilidade(ClassificacaoDeProtecaoCodigo.INTERNO),
};
export const ESCRITA: PermissaoDoPerfilDto = {
  codigo: 'selecao:processos:configurar',
  nome: 'Configurar processos',
  sensibilidade: sensibilidade(ClassificacaoDeProtecaoCodigo.INTERNO),
};
export const APROVACAO: PermissaoDoPerfilDto = {
  codigo: 'selecao:processos:aprovar',
  nome: 'Aprovar processos',
  sensibilidade: sensibilidade(ClassificacaoDeProtecaoCodigo.PESSOAL),
};

const VERSAO_PENDENTE = {
  versaoId: 'v2',
  numero: 2,
  nome: 'Operador de inscrições',
  descricao: 'Opera as inscrições.',
  protocolo: 'P-2/2026',
  documentoId: 'd2',
  situacaoDoDocumento: situacaoDoAnexo(SituacaoDoAnexoCodigo.VERIFICADO),
  criadaEm: '2026-11-02T12:00:00Z',
  expiraEm: '2026-11-16T12:00:00Z',
  etapaAtual: etapaDaVersao(EtapaDaVersaoCodigo.GESTAO_DE_ACESSOS),
  exigeProtecaoDeDados: true,
  etapasExigidas: [ETAPA_GESTAO, ETAPA_PROTECAO],
  criadorTemConcessao: false,
  propostaPorQuemLe: false,
} satisfies Partial<VersaoPendenteDto>;

/** Uma versão pendente na gestão de acessos; as listas são novas a cada chamada. */
export function versaoPendente(parcial: Partial<VersaoPendenteDto> = {}): VersaoPendenteDto {
  return {
    ...VERSAO_PENDENTE,
    permissoes: [LEITURA, ESCRITA, APROVACAO],
    acrescimo: [APROVACAO],
    remocao: [],
    decisoes: [],
    ...parcial,
  };
}

const PERFIL_DO_DETALHE = {
  id: 'p1',
  nome: 'Operador de inscrições',
  descricao: 'Opera as inscrições.',
  ativo: true,
  governanca: null,
  sensibilidade: sensibilidade(ClassificacaoDeProtecaoCodigo.INTERNO),
  situacaoDoAcesso: ACESSO_EM_VIGOR,
  versaoPendente: null,
  ultimaVersaoEncerradaSemVigor: null,
  suspensao: null,
  desativadoDesde: null,
} satisfies Partial<PerfilDto>;

/** Um perfil ativo com a versão 1 em vigor; a composição é nova a cada chamada. */
export function perfilDoDetalhe(parcial: Partial<PerfilDto> = {}): PerfilDto {
  return {
    ...PERFIL_DO_DETALHE,
    composicaoEmVigor: {
      versaoId: 'v1',
      numero: 1,
      permissoes: [LEITURA, ESCRITA],
      protocolo: 'P-1/2026',
      documentoVerificadoEm: '2026-10-20T12:00:00Z',
      desde: '2026-10-21T12:00:00Z',
    },
    ...parcial,
  };
}
