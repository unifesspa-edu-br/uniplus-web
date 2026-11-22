import { faseDoServidor } from './cronograma-do-servidor';

export const PROCESSO_ID = '01960000-0000-7000-0000-000000000901';
export const DOCUMENTO_ID = '01960000-0000-7000-0000-000000000902';
export const ATO_ID = '01960000-0000-7000-0000-000000000908';
const ANEXO_A = '01960000-0000-7000-0000-00000000090a';
const ANEXO_B = '01960000-0000-7000-0000-00000000090b';

export const TIPO_ATO_DTO = {
  id: '01960000-0000-7000-0000-000000000903',
  codigo: 'PORTARIA',
  nome: 'Portaria',
  congelaConfiguracao: true,
  unicoPorObjeto: false,
  efeitoIrreversivel: true,
  ehResultado: false,
  vigenciaInicio: '2020-01-01',
  vigenciaFim: null,
  baseLegal: null,
  criadoEm: '2020-01-01T00:00:00Z',
};

/** Fase com `coletaInscricao: true` — o período de inscrição some da tela e vem da janela dela. */
export const FASE_DE_COLETA = faseDoServidor({
  faseCanonica: { origemData: 'DECLARADA' },
});

export const ATO_DTO = {
  id: ATO_ID,
  orgao: 'CEPS/Unifesspa',
  serie: 'Edital de abertura',
  ano: 2027,
  numero: '001/2027',
  tipoCodigo: TIPO_ATO_DTO.codigo,
  congelaConfiguracao: true,
  efeitoIrreversivel: true,
  unicoPorObjeto: false,
  dataDoAto: '2027-01-15',
  documentoHash: 'b'.repeat(64),
  assinante: 'Reitor da Unifesspa',
  publicadoEm: '2027-01-15T12:00:00Z',
  versaoDoObjetoId: null,
  versaoDoObjetoHash: null,
  atoRetificadoId: null,
  motivoRetificacao: null,
  avisos: null,
  _links: null,
};

/** O que o processo publicado declara publicar: sem fase nem etapa com item previsto. */
export const PREVISTOS_DO_PROCESSO = {
  numeroDaVersao: 1,
  politicaDeDivulgacao: { camposPublicos: [], justificativa: null },
  fases: [],
  etapasSemFase: [],
};

export const DOCUMENTO_CONFIRMADO_DO_EDITAL = {
  id: DOCUMENTO_ID,
  processoSeletivoId: PROCESSO_ID,
  finalidade: 'documentoDoEdital',
  nomeArquivo: 'edital.pdf',
  tipoDeMidia: 'application/pdf',
  status: 'Confirmado',
  criadoEm: '2027-01-01T00:00:00Z',
  expiraEm: '2027-01-01T01:00:00Z',
  tamanhoBytes: 123456,
  hashSha256: 'a'.repeat(64),
  confirmadoEm: '2027-01-01T00:10:00Z',
};

export const SNAPSHOT_DA_PUBLICACAO = {
  snapshotPublicacaoId: '01960000-0000-7000-0000-000000000909',
  atoId: ATO_ID,
  schemaVersion: '1',
  algoritmoHash: 'c'.repeat(64),
  hashConfiguracao: 'd'.repeat(64),
  hashEdital: 'a'.repeat(64),
  configuracao: {},
};

const ATO_PUBLICADO_DO_PROCESSO = {
  id: ATO_ID,
  tipoCodigo: TIPO_ATO_DTO.codigo,
  tipoNome: 'Portaria',
  numero: '001/2027',
  dataDoAto: '2027-01-15',
  publicadoEm: '2027-01-15T12:00:00Z',
  assinante: 'Reitor da Unifesspa',
  atoCorrigidoId: null,
  motivoDaCorrecao: null,
  politicaDeDivulgacaoConfirmada: false,
};

function documentoDoAto(id: string, nomeArquivo: string, nomeDeExibicao: string | null) {
  return {
    documentoAPublicarId: id,
    nomeArquivo,
    nomeDeExibicao,
    tipoDeMidia: 'application/pdf',
    hashSha256: 'e'.repeat(64),
  };
}

export function atoDoProcesso() {
  return {
    ...ATO_PUBLICADO_DO_PROCESSO,
    documentoPrincipal: documentoDoAto(DOCUMENTO_ID, 'edital.pdf', null),
    anexos: [
      documentoDoAto(ANEXO_A, 'cronograma.pdf', 'Cronograma detalhado.pdf'),
      documentoDoAto(ANEXO_B, 'modelo-de-recurso.pdf', null),
    ],
  };
}

const IDENTIFICACAO_DO_PROCESSO = {
  id: PROCESSO_ID,
  nome: 'Processo Seletivo de teste',
  tipoProcesso: {
    origemId: '01960000-0000-7000-0000-000000000905',
    codigo: 'GRAD',
    nome: 'Graduação',
  },
  origemCandidatos: 'inscricaoPropria',
  unidadeAdministradora: {
    origemId: '01960000-0000-7000-0000-000000000906',
    sigla: 'CEPS',
    slug: 'ceps',
    nome: 'CEPS',
    tipo: 'PROREITORIA',
    cidadeCodigoIbge: '1500107',
    cidadeNome: 'Marabá',
    cidadeUf: 'PA',
  },
  localidade: { codigoIbge: '1500107', nome: 'Marabá', uf: 'PA' },
};

const DIMENSOES_SEM_CADASTRO = {
  etapas: [],
  atendimentoEspecializado: null,
  distribuicaoVagas: [],
  bonusRegional: null,
  aplicaBonusRegional: false,
  cascata: null,
  criteriosDesempate: [],
  documentosExigidos: [],
  regrasDeComprovacao: [],
  referenciaTemporalFatos: null,
  regrasDerivacao: [],
  formularios: [],
  opcoesDeclaradas: [],
  configuracaoDivulgacao: null,
  configuracaoTaxaInscricao: null,
  algoritmoContagemPrazo: null,
  criadoEm: '2027-01-01T00:00:00Z',
};

/**
 * O `status` usa o vocabulário do wire, camelCase, e não o nome do enum C#: `status: 'Rascunho'`
 * faria hidratar() marcar o processo como somente leitura (edicaoPermitida() compara com
 * StatusProcesso.rascunho === 'rascunho') e todo campo do formulário nasceria desabilitado.
 */
export function processoDto(
  cronogramaFases: readonly unknown[],
  status: string,
  classificacao: unknown = null,
) {
  return {
    ...IDENTIFICACAO_DO_PROCESSO,
    status,
    ...DIMENSOES_SEM_CADASTRO,
    classificacao,
    cronogramaFases,
  };
}
