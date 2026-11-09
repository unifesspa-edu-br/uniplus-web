import type { PerfilDto, VersaoPendenteDto } from '@uniplus/shared-data/autorizacao';

export const LEITURA = {
  codigo: 'selecao:processos:consultar',
  nome: 'Consultar processos',
  sensibilidade: 'interno',
} as const;
export const ESCRITA = {
  codigo: 'selecao:processos:configurar',
  nome: 'Configurar processos',
  sensibilidade: 'interno',
} as const;
export const APROVACAO = {
  codigo: 'selecao:processos:aprovar',
  nome: 'Aprovar processos',
  sensibilidade: 'pessoal',
} as const;

export function versaoPendente(parcial: Partial<VersaoPendenteDto> = {}): VersaoPendenteDto {
  return {
    versaoId: 'v2',
    numero: 2,
    nome: 'Operador de inscrições',
    descricao: 'Opera as inscrições.',
    permissoes: [LEITURA, ESCRITA, APROVACAO],
    protocolo: 'P-2/2026',
    documentoId: 'd2',
    situacaoDoDocumento: 'verificado',
    criadaEm: '2026-11-02T12:00:00Z',
    expiraEm: '2026-11-16T12:00:00Z',
    etapaAtual: 'gestao_de_acessos',
    exigeProtecaoDeDados: true,
    acrescimo: [APROVACAO],
    remocao: [],
    decisoes: [],
    criadorTemConcessao: false,
    ...parcial,
  };
}

export function perfilDoDetalhe(parcial: Partial<PerfilDto> = {}): PerfilDto {
  return {
    id: 'p1',
    nome: 'Operador de inscrições',
    descricao: 'Opera as inscrições.',
    ativo: true,
    governanca: null,
    sensibilidade: 'interno',
    composicaoEmVigor: {
      versaoId: 'v1',
      numero: 1,
      permissoes: [LEITURA, ESCRITA],
      protocolo: 'P-1/2026',
      documentoVerificadoEm: '2026-10-20T12:00:00Z',
      desde: '2026-10-21T12:00:00Z',
    },
    versaoPendente: null,
    ultimaVersaoEncerradaSemVigor: null,
    ...parcial,
  };
}
