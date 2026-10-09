import { PROCESSO_PUBLICADO_DA_MEDICINA } from './consulta-da-medicina';

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

/** A referência congelada de uma regra do catálogo, como o detalhe do processo a devolve. */
function referencia(codigo: string) {
  return { codigo, versao: '1.0', hash: `hash-${codigo}` };
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
    documento: {
      id: `${id}-doc`,
      exigidoNaFaseId: FASE_ID,
      tipoDocumentoCategoria: 'IDENTIFICACAO',
      condicoes: [],
      basesLegais: [
        {
          id: `${id}-norma`,
          referencia: 'Edital nº 1/2027, Anexo III',
          abrangencia: 'INTERNA_EDITAL',
          status: 'RESOLVIDO',
          observacao: null,
        },
      ],
      idadeMaximaEmissao: null,
      formatosPermitidos: ['pdf'],
      tamanhoMaximoBytes: 10485760,
      exigidoNaEtapaId: null,
      ...documento,
    },
  };
}

export const PROCESSO_PUBLICADO_COMPLETO = {
  ...PROCESSO_PUBLICADO_DA_MEDICINA,
  aplicaBonusRegional: true,
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
    nOpcoesAlocacao: 1,
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
    resolucaoPesoAreaEnem: null,
    quadroPesoAreaEnem: [],
  },
  etapas: [
    {
      id: '01a0d640-0000-7000-8000-0000000000f1',
      nome: 'Prova objetiva',
      carater: 'classificatoria',
      tipoEtapa: {
        origemId: TIPO_ETAPA_ID,
        codigo: 'PROVA_OBJETIVA',
        nome: 'Prova objetiva',
        notaDeOrigemNoEnem: false,
      },
      peso: 2,
      notaMinima: null,
      ordem: 1,
      faseCodigo: CODIGO_DA_FASE,
      produtos: [{ id: PRODUTO_ID, atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' }],
      inicio: '2027-01-20T08:00:00Z',
      fim: '2027-01-20T12:00:00Z',
      emiteParecerIndividual: true,
      bancas: [
        {
          id: '01a0d640-0000-7000-8000-0000000000f2',
          tipoBancaOrigemId: TIPO_BANCA_ID,
          codigo: 'BANCA_GERAL',
        },
      ],
      recursos: [
        {
          id: '01a0d640-0000-7000-8000-0000000000f3',
          ancora: 'atoPublicado',
          regra: referencia('RECURSO-PRAZO-ANCORADO-EM-ATO'),
          args: {
            prazoValor: 2,
            prazoUnidade: 'diasUteis',
            suspensividadePrimeiraInstanciaValor: null,
            suspensividadePrimeiraInstanciaUnidade: null,
            suspensividadeSegundaInstanciaValor: null,
            suspensividadeSegundaInstanciaUnidade: null,
          },
          produtoAncoraId: PRODUTO_ID,
          atoAncoraCodigo: 'RESULTADO_PRELIMINAR',
        },
      ],
    },
  ],
  cronogramaFases: [
    {
      id: FASE_ID,
      ordem: 1,
      faseCanonicaOrigemId: FASE_CANONICA_ID,
      codigo: CODIGO_DA_FASE,
      donoInstitucional: 'CEPS',
      origemData: 'PROPRIA',
      agrupaEtapas: true,
      permiteComplementacao: false,
      produzResultado: true,
      coletaInscricao: true,
      coletaSolicitacaoIsencao: false,
      inicio: '2027-01-01T00:00:00Z',
      fim: '2027-01-31T23:59:59Z',
      produtos: [{ id: PRODUTO_ID, atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' }],
      faseConcluinteCodigo: null,
      emiteParecerIndividual: false,
      bancasRequeridas: [
        {
          id: '01a0d640-0000-7000-8000-0000000000c3',
          tipoBancaOrigemId: TIPO_BANCA_ID,
          codigo: 'BANCA_GERAL',
          recorteDeCompetencia: [
            {
              id: '01a0d640-0000-7000-8000-0000000000c4',
              categoriaDocumentoOrigemId: CATEGORIA_ID,
              codigo: 'IDENTIFICACAO',
            },
          ],
        },
      ],
      regraRecurso: {
        id: '01a0d640-0000-7000-8000-0000000000c5',
        produtoAncoraId: PRODUTO_ID,
        regra: referencia('RECURSO-PRAZO-ANCORADO-EM-ATO'),
        args: {
          prazoValor: 2,
          prazoUnidade: 'diasUteis',
          suspensividadePrimeiraInstanciaValor: null,
          suspensividadePrimeiraInstanciaUnidade: null,
          suspensividadeSegundaInstanciaValor: null,
          suspensividadeSegundaInstanciaUnidade: null,
        },
      },
    },
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
  dataPublicacao: '2027-01-15',
  documentoHash: 'b'.repeat(64),
  assinante: 'Reitor da Unifesspa',
  registradoEm: '2027-01-15T12:00:00Z',
  versaoInvocadaId: null,
  versaoInvocadaHash: null,
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

export const DOCUMENTO_DO_EDITAL = {
  id: '01a0d640-0000-7000-8000-0000000000ac',
  processoSeletivoId: ID_DO_PROCESSO_COMPLETO,
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
    donoTipico: 'CEPS',
    agrupaEtapas: true,
    permiteComplementacao: false,
    baseLegal: null,
    coletaInscricao: true,
    origemData: 'PROPRIA',
    criadoEm: '2026-08-30T12:00:00Z',
  },
] as const;
