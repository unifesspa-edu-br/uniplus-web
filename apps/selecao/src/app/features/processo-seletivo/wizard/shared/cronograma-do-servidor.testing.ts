import {
  CaraterEtapaCodigo,
  EfeitoSuspensivoCodigo,
  type EtapaProcessoDto,
  type FaseCronogramaDto,
  GuardaDaVagaCodigo,
  PapelDaBancaCodigo,
  TipoDeBancaCodigo,
  type TipoMotivoDeDecisaoCodigo,
  UnidadePrazoCodigo,
} from '@uniplus/shared-data/selecao';

/** O tipo de decisão como o servidor o devolve; o rótulo repete o código. */
export function tipoDeDecisaoDoServidor(codigo: TipoMotivoDeDecisaoCodigo) {
  return { codigo, rotulo: codigo };
}

/** O que o servidor devolve do tipo de banca em cada banca da fase ou da etapa. */
export function tipoDeBancaDoServidor(codigo: TipoDeBancaCodigo) {
  return {
    codigo: { codigo, rotulo: codigo },
    posicaoNoTipo: 1,
    papel: { codigo: PapelDaBancaCodigo.AVALIA_O_MERITO, rotulo: 'Avalia o mérito' },
    exigeDuasOuMaisBancas: false,
    encerraRecursoNaPrimeiraInstancia: false,
    tiposDeDecisaoJulgados: [],
  };
}

/** A fase como o servidor a devolve; cada seção aninhada aceita só os campos que o teste troca. */
export interface FaseDoServidorParcial {
  readonly id?: string;
  readonly codigo?: string;
  readonly faseCanonica?: Partial<FaseCronogramaDto['faseCanonica']>;
  readonly cronograma?: Partial<FaseCronogramaDto['cronograma']>;
  readonly publicacoes?: Partial<FaseCronogramaDto['publicacoes']>;
  readonly bancasRequeridas?: FaseCronogramaDto['bancasRequeridas'];
}

/** A etapa como o servidor a devolve; cada seção aninhada aceita só os campos que o teste troca. */
export interface EtapaDoServidorParcial {
  readonly id?: string;
  readonly identificacao?: Partial<EtapaProcessoDto['identificacao']>;
  readonly nota?: Partial<EtapaProcessoDto['nota']>;
  readonly avaliacao?: Partial<EtapaProcessoDto['avaliacao']>;
  readonly janela?: Partial<EtapaProcessoDto['janela']>;
  readonly publicacoes?: Partial<EtapaProcessoDto['publicacoes']>;
  readonly bancas?: EtapaProcessoDto['bancas'];
}

type RecursoDaFaseDoServidor = NonNullable<FaseCronogramaDto['publicacoes']['regraRecurso']>;

export const PARAMETROS_DO_RECURSO: RecursoDaFaseDoServidor['parametros'] = {
  prazoValor: 2,
  prazoUnidade: { codigo: UnidadePrazoCodigo.DIAS_UTEIS, rotulo: 'Dias úteis' },
  admiteInstanciaSuperior: true,
  prazoSegundaInstanciaValor: 3,
  prazoSegundaInstanciaUnidade: { codigo: UnidadePrazoCodigo.DIAS_UTEIS, rotulo: 'Dias úteis' },
  efeitoSuspensivo: {
    codigo: EfeitoSuspensivoCodigo.SEM_EFEITO_SUSPENSIVO,
    rotulo: 'Sem efeito suspensivo',
  },
  guardaDaVaga: {
    codigo: GuardaDaVagaCodigo.ATE_O_RESULTADO_DEFINITIVO,
    rotulo: 'Guarda a vaga até o resultado definitivo',
  },
};

export const RECURSO_DA_FASE: RecursoDaFaseDoServidor = {
  id: 'snapshot-recurso',
  produtoAncoraId: 'produto-preliminar',
  regra: { codigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO', versao: 'v1', hash: 'abc123' },
  parametros: PARAMETROS_DO_RECURSO,
  procedimentos: [],
};

const FASE_CANONICA: FaseCronogramaDto['faseCanonica'] = {
  origemId: 'fase-canonica-homologacao',
  origemData: {
    codigo: 'NO_EDITAL' as FaseCronogramaDto['faseCanonica']['origemData']['codigo'],
    rotulo: 'No edital',
  },
  agrupaEtapas: false,
  permiteComplementacao: true,
  coletaInscricao: false,
  coletaSolicitacaoIsencao: false,
};

const CRONOGRAMA_DA_FASE: FaseCronogramaDto['cronograma'] = {
  ordem: 2,
  inicio: '2026-03-25T08:00:00-03:00',
  fim: '2026-03-25T23:59:59-03:00',
  noMesmoMomentoDaAnterior: false,
  unidadeResponsavel: null,
};

const PUBLICACOES_DA_FASE: FaseCronogramaDto['publicacoes'] = {
  produtos: [
    {
      id: 'produto-preliminar',
      atoCodigo: 'RESULTADO_HOMOLOGACAO',
      papel: {
        codigo: 'PRELIMINAR' as NonNullable<
          FaseCronogramaDto['publicacoes']['produtos'][number]['papel']
        >['codigo'],
        rotulo: 'Preliminar',
      },
    },
    { id: 'produto-aviso', atoCodigo: 'COMUNICADO_HOMOLOGACAO', papel: null },
  ],
  produzResultado: true,
  emiteParecerIndividual: true,
  regraRecurso: RECURSO_DA_FASE,
  tiposDeDecisao: [],
  regraDeHomologacao: null,
};

const BANCA_REQUERIDA: FaseCronogramaDto['bancasRequeridas'][number] = {
  id: 'snapshot-banca',
  chave: 'banca-1',
  tipoBancaOrigemId: 'tipo-banca-1',
  ...tipoDeBancaDoServidor(TipoDeBancaCodigo.BANCA_ANALISE_RECURSOS),
  nome: 'Análise de recursos',
  regraDeDeliberacao: null,
  candidatosAtendidos: [
    { id: 'snapshot-categoria', categoriaDocumentoOrigemId: 'categoria-renda', codigo: 'RENDA' },
  ],
};

/**
 * Fase que produz resultado e admite recurso — o caso completo. A janela vem com
 * deslocamento, e é assim que precisa voltar: truncar para data perderia a hora
 * que separa o fim de um dia do começo do seguinte.
 */
export function faseDoServidor(parcial: FaseDoServidorParcial = {}): FaseCronogramaDto {
  return {
    chave: 'fase-1',
    id: parcial.id ?? 'snapshot-fase-1',
    codigo: parcial.codigo ?? 'HOMOLOGACAO',
    faseCanonica: { ...FASE_CANONICA, ...parcial.faseCanonica },
    cronograma: { ...CRONOGRAMA_DA_FASE, ...parcial.cronograma },
    publicacoes: { ...PUBLICACOES_DA_FASE, ...parcial.publicacoes },
    bancasRequeridas: parcial.bancasRequeridas ?? [BANCA_REQUERIDA],
  };
}

const IDENTIFICACAO_DA_ETAPA: EtapaProcessoDto['identificacao'] = {
  nome: 'Prova Objetiva',
  carater: { codigo: CaraterEtapaCodigo.CLASSIFICATORIA, rotulo: 'Classificatória' },
  tipoEtapa: {
    origemId: 'tipo-etapa-1',
    codigo: 'PROVA_OBJETIVA',
    nome: 'Prova Objetiva',
    notaDeOrigemNoEnem: false,
    exigeCorrecaoIndependente: false,
  },
  ordem: 1,
  faseCodigo: null,
};

const NOTA_DA_ETAPA: EtapaProcessoDto['nota'] = {
  peso: 2,
  notaMinima: null,
  notaMaxima: null,
  passoDoLancamento: null,
};

const AVALIACAO_DA_ETAPA: EtapaProcessoDto['avaliacao'] = {
  formaDeAvaliacao: null,
  regraConsolidacao: null,
  itensDeAvaliacao: [],
  escalaDeAtendimento: null,
};

const PUBLICACOES_DA_ETAPA: EtapaProcessoDto['publicacoes'] = {
  produtos: [],
  emiteParecerIndividual: false,
  recursos: [],
  tiposDeDecisao: [],
};

/** Etapa classificatória de prova, sem janela, banca nem recurso. */
export function etapaDoServidor(parcial: EtapaDoServidorParcial = {}): EtapaProcessoDto {
  return {
    chave: 'etapa-1',
    id: parcial.id ?? 'etapa-persistida-1',
    identificacao: { ...IDENTIFICACAO_DA_ETAPA, ...parcial.identificacao },
    nota: { ...NOTA_DA_ETAPA, ...parcial.nota },
    avaliacao: { ...AVALIACAO_DA_ETAPA, ...parcial.avaliacao },
    janela: { inicio: null, fim: null, ...parcial.janela },
    publicacoes: { ...PUBLICACOES_DA_ETAPA, ...parcial.publicacoes },
    bancas: parcial.bancas ?? [],
  };
}

type RecursoDaEtapaDoServidor = EtapaProcessoDto['publicacoes']['recursos'][number];

const ATO_PUBLICADO = {
  codigo: 'PUBLICACAO_DO_ATO' as RecursoDaEtapaDoServidor['ancora']['codigo'],
  rotulo: 'Ato publicado',
};

/** Recurso da etapa ancorado na publicação de um ato, com os parâmetros do exemplo da fase. */
export function recursoDaEtapaDoServidor(
  parcial: Partial<RecursoDaEtapaDoServidor> = {},
): RecursoDaEtapaDoServidor {
  return {
    id: 'recurso-da-etapa-1',
    ancora: ATO_PUBLICADO,
    regra: { codigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO', versao: '1.0.0', hash: 'abc123' },
    parametros: PARAMETROS_DO_RECURSO,
    produtoAncoraId: 'produto-da-etapa-1',
    atoAncoraCodigo: 'RESULTADO_PRELIMINAR',
    procedimentos: [],
    ...parcial,
  };
}
