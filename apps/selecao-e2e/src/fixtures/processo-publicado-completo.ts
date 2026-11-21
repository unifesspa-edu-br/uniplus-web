import type { EtapaProcessoDto } from '@uniplus/shared-data/selecao';
import { PROCESSO_PUBLICADO_DA_MEDICINA } from './consulta-da-medicina';
import {
  etapaDoServidor,
  faseDoServidor,
  PARAMETROS_DO_RECURSO_DO_SERVIDOR,
} from './cronograma-do-servidor';

type RecursoDaEtapa = EtapaProcessoDto['publicacoes']['recursos'][number];

/**
 * O processo da Medicina 2027 publicado, com os 12 passos preenchidos: é o que a varredura da
 * consulta (web#905) percorre. Soma ao que a fixture de consulta já traz — tipo, identificação,
 * taxa, atendimento, formulário, quadro de vagas e cascata — o bônus, o desempate, a
 * classificação com a regra de eliminação, uma fase de coleta com recurso e banca, uma etapa
 * pontuada e dois documentos exigidos.
 *
 * Só dado de catálogo e de configuração do certame: nenhum dado de candidato.
 */
export const ID_DO_PROCESSO_COMPLETO = PROCESSO_PUBLICADO_DA_MEDICINA.id;

const FASE_ID = '01a0d640-0000-7000-8000-0000000000a1';
const FASE_CANONICA_ID = '01a0d640-0000-7000-8000-0000000000a2';
const CODIGO_DA_FASE = 'COLETA_INSCRICAO';
const TIPO_ETAPA_ID = '01a0d640-0000-7000-8000-0000000000b1';
const TIPO_BANCA_ID = '01a0d640-0000-7000-8000-0000000000c1';
const CATEGORIA_ID = '01a0d640-0000-7000-8000-0000000000c2';
const PRODUTO_ID = '01a0d640-0000-7000-8000-0000000000d1';
const BASE_LEGAL_BONUS_REGIONAL_ID = 'ba5e0000-0000-7000-8000-000000000001';

/** A unidade que responde pela fase, como a cópia gravada no processo a devolve. */
export const UNIDADE_RESPONSAVEL_DA_FASE = {
  origemId: '01a0d640-0000-7000-8000-0000000000a3',
  sigla: 'CEPS',
  slug: 'ceps',
  nome: 'Centro de Processos Seletivos',
} as const;

const PARAMETROS_DO_RECURSO: RecursoDaEtapa['parametros'] = {
  ...PARAMETROS_DO_RECURSO_DO_SERVIDOR,
  admiteInstanciaSuperior: true,
  prazoSegundaInstanciaValor: 3,
  prazoSegundaInstanciaUnidade: { codigo: 'diasUteis', rotulo: 'Dias úteis' },
} as RecursoDaEtapa['parametros'];

/** A referência congelada de uma regra do catálogo, como o detalhe do processo a devolve. */
function referencia(codigo: string) {
  return { codigo, versao: '1.0', hash: `hash-${codigo}` };
}

function normaDoDocumento(id: string) {
  return {
    id: `${id}-norma`,
    referencia: 'Edital nº 1/2027, Anexo III',
    abrangencia: 'INTERNA_EDITAL',
    status: 'RESOLVIDO',
    observacao: null,
  };
}

function documentoDaFolha(id: string, documento: Record<string, unknown>) {
  return {
    id: `${id}-doc`,
    exigidoNaFaseId: FASE_ID,
    tipoDocumentoCategoria: 'IDENTIFICACAO',
    condicoes: [],
    basesLegais: [normaDoDocumento(id)],
    idadeMaximaEmissao: null,
    formatosPermitidos: ['pdf'],
    tamanhoMaximoBytes: 10485760,
    exigidoNaEtapaId: null,
    ...documento,
  };
}

function folha(id: string, documento: Record<string, unknown>) {
  return {
    id,
    tipo: 'FOLHA',
    quantidadeMinima: null,
    consequencia: null,
    basesLegais: [],
    filhos: [],
    chaveDistincao: null,
    dataReferencia: null,
    ocorrenciasEsperadas: null,
    repetePorEntidade: null,
    documento: documentoDaFolha(id, documento),
  };
}

export const PROCESSO_PUBLICADO_COMPLETO = {
  ...PROCESSO_PUBLICADO_DA_MEDICINA,
  aplicaBonusRegional: true,
  opcoesDeCurso: { numero: 1 },
  bonusRegional: {
    id: '01a0d640-0000-7000-8000-0000000000e1',
    regra: referencia('BONUS-MULTIPLICATIVO'),
    fator: 1.2,
    teto: null,
    baseLegalBonusRegionalId: BASE_LEGAL_BONUS_REGIONAL_ID,
    tipoInstrumento: 'PORTARIA',
    identificacao: 'Portaria Unifesspa nº 2514/2023',
    descricao: 'Institui inclusão regional.',
    municipios: [{ codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' }],
  },
  criteriosDesempate: [
    {
      id: '01a0d640-0000-7000-8000-0000000000e2',
      ordem: 1,
      regra: referencia('DESEMPATE-MAIOR-IDADE'),
      etapaRef: null,
      idadeMinima: null,
      fato: null,
      operador: null,
      valor: null,
      areas: null,
    },
  ],
  classificacao: {
    id: '01a0d640-0000-7000-8000-0000000000e3',
    regraCalculo: referencia('FORMULA-MEDIA-PONDERADA'),
    regraArredondamento: referencia('ARRED-TRUNCAR'),
    casasArredondamento: 2,
    regraOrdemAlocacao: referencia('ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA'),
    regrasEliminacao: [
      {
        id: '01a0d640-0000-7000-8000-0000000000e4',
        regra: referencia('ELIM-ZERO-EM-AREA'),
        etapaRef: null,
        notaMinima: null,
        minimo: null,
        areaCodigo: null,
      },
    ],
    concorrenciaDuplaAplicavel: false,
    baseadoEmEnem: false,
    escalaNotaFinal: 100,
    resolucaoPesoAreaEnem: null,
    quadroPesoAreaEnem: [],
  },
  etapas: [
    etapaDoServidor({
      id: '01a0d640-0000-7000-8000-0000000000f1',
      identificacao: {
        tipoEtapa: {
          origemId: TIPO_ETAPA_ID,
          codigo: 'PROVA_OBJETIVA',
          nome: 'Prova objetiva',
          notaDeOrigemNoEnem: false,
          exigeCorrecaoIndependente: false,
        },
        faseCodigo: CODIGO_DA_FASE,
      },
      janela: { inicio: '2027-01-20T08:00:00Z', fim: '2027-01-20T12:00:00Z' },
      publicacoes: {
        produtos: [{ id: PRODUTO_ID, atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' }],
        emiteParecerIndividual: true,
        recursos: [
          {
            id: '01a0d640-0000-7000-8000-0000000000f3',
            ancora: 'atoPublicado' as RecursoDaEtapa['ancora'],
            regra: referencia('RECURSO-PRAZO-ANCORADO-EM-ATO'),
            parametros: PARAMETROS_DO_RECURSO,
            produtoAncoraId: PRODUTO_ID,
            atoAncoraCodigo: 'RESULTADO_PRELIMINAR',
            procedimentos: [],
          },
        ],
      },
      bancas: [
        {
          id: '01a0d640-0000-7000-8000-0000000000f2',
          tipoBancaOrigemId: TIPO_BANCA_ID,
          codigo: 'BANCA_GERAL',
          nome: 'Banca geral',
          regraDeDeliberacao: null,
        },
      ],
    }),
  ],
  cronogramaFases: [
    faseDoServidor({
      id: FASE_ID,
      codigo: CODIGO_DA_FASE,
      faseCanonica: {
        origemId: FASE_CANONICA_ID,
        agrupaEtapas: true,
        coletaInscricao: true,
      },
      cronograma: { unidadeResponsavel: UNIDADE_RESPONSAVEL_DA_FASE },
      publicacoes: {
        produtos: [{ id: PRODUTO_ID, atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' }],
        produzResultado: true,
        regraRecurso: {
          id: '01a0d640-0000-7000-8000-0000000000c5',
          produtoAncoraId: PRODUTO_ID,
          regra: referencia('RECURSO-PRAZO-ANCORADO-EM-ATO'),
          parametros: PARAMETROS_DO_RECURSO,
          procedimentos: [],
        },
      },
      bancasRequeridas: [
        {
          id: '01a0d640-0000-7000-8000-0000000000c3',
          tipoBancaOrigemId: TIPO_BANCA_ID,
          codigo: 'BANCA_GERAL',
          nome: 'Banca geral',
          regraDeDeliberacao: null,
          recorteDeCompetencia: [
            {
              id: '01a0d640-0000-7000-8000-0000000000c4',
              categoriaDocumentoOrigemId: CATEGORIA_ID,
              codigo: 'IDENTIFICACAO',
            },
          ],
        },
      ],
    }),
  ],
  raizesExigencia: [
    folha('01a0d640-0000-7000-8000-000000000a11', {
      tipoDocumentoOrigemId: '01a0d640-0000-7000-8000-000000000a21',
      tipoDocumentoCodigo: 'DOC_IDENTIDADE',
      tipoDocumentoNome: 'Documento de identidade',
      aplicabilidade: 'GERAL',
      obrigatorio: true,
      consequenciaIndeferimento: 'ELIMINA',
    }),
    folha('01a0d640-0000-7000-8000-000000000a12', {
      tipoDocumentoOrigemId: '01a0d640-0000-7000-8000-000000000a22',
      tipoDocumentoCodigo: 'AUTODECLARACAO_PPI',
      tipoDocumentoNome: 'Autodeclaração étnico-racial',
      aplicabilidade: 'CONDICIONAL',
      obrigatorio: false,
      consequenciaIndeferimento: 'RECLASSIFICA_AC',
      condicoes: [
        {
          id: '01a0d640-0000-7000-8000-000000000a13',
          clausula: 1,
          fato: 'MODALIDADE',
          operador: 'EM',
          valor: '["LB_PPI"]',
        },
      ],
    }),
  ],
  algoritmoContagemPrazo: referencia('CONTAGEM-PRAZO-DIAS-UTEIS'),
} as const;

/** O ato da publicação e o snapshot vigente que a Revisão lê no processo publicado. */
export const ATO_PUBLICADO = {
  id: '01a0d640-0000-7000-8000-0000000000aa',
  orgao: 'CEPS/Unifesspa',
  serie: 'Edital de abertura',
  ano: 2027,
  numero: '001/2027',
  tipoCodigo: 'PORTARIA',
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
} as const;

export const SNAPSHOT_VIGENTE = {
  snapshotPublicacaoId: '01a0d640-0000-7000-8000-0000000000ab',
  atoId: ATO_PUBLICADO.id,
  schemaVersion: '1',
  algoritmoHash: 'c'.repeat(64),
  hashConfiguracao: 'd'.repeat(64),
  hashEdital: 'a'.repeat(64),
  configuracao: {},
} as const;

/** O ato da versão vigente, como a consulta dos atos do processo o devolve, com um anexo do edital. */
export const ATO_DO_PROCESSO = {
  id: ATO_PUBLICADO.id,
  tipoCodigo: 'PORTARIA',
  tipoNome: 'Portaria',
  numero: '001/2027',
  dataDoAto: '2027-01-15',
  publicadoEm: '2027-01-15T12:00:00Z',
  assinante: 'Reitor da Unifesspa',
  atoCorrigidoId: null,
  motivoDaCorrecao: null,
  politicaDeDivulgacaoConfirmada: false,
  documentoPrincipal: {
    documentoAPublicarId: '01a0d640-0000-7000-8000-0000000000ac',
    nomeArquivo: 'edital.pdf',
    nomeDeExibicao: null,
    tipoDeMidia: 'application/pdf',
    hashSha256: 'a'.repeat(64),
  },
  anexos: [
    {
      documentoAPublicarId: '01a0d640-0000-7000-8000-0000000000ad',
      nomeArquivo: 'cronograma.pdf',
      nomeDeExibicao: 'Cronograma detalhado.pdf',
      tipoDeMidia: 'application/pdf',
      hashSha256: 'c'.repeat(64),
    },
  ],
} as const;

export const DOCUMENTO_DO_EDITAL = {
  id: '01a0d640-0000-7000-8000-0000000000ac',
  processoSeletivoId: ID_DO_PROCESSO_COMPLETO,
  finalidade: 'documentoDoEdital',
  nomeArquivo: 'edital.pdf',
  tipoDeMidia: 'application/pdf',
  status: 'Confirmado',
  criadoEm: '2027-01-01T00:00:00Z',
  expiraEm: '2027-01-01T01:00:00Z',
  tamanhoBytes: 123456,
  hashSha256: 'a'.repeat(64),
  confirmadoEm: '2027-01-01T00:10:00Z',
} as const;

/** A fase do catálogo institucional que o cronograma do processo referencia. */
export const FASES_CANONICAS = [
  {
    id: FASE_CANONICA_ID,
    codigo: CODIGO_DA_FASE,
    nome: 'Inscrição',
    descricao: null,
    unidadeSugerida: null,
    agrupaEtapas: true,
    permiteComplementacao: false,
    admiteAgruparEtapas: true,
    admiteComplementacao: false,
    baseLegal: null,
    coletaInscricao: true,
    origemData: 'NO_EDITAL',
    criadoEm: '2026-08-30T12:00:00Z',
  },
] as const;
