import type { EtapaProcessoDto, FaseCronogramaDto } from '@uniplus/shared-data/selecao';

/**
 * A fase e a etapa do cronograma como o servidor as devolve no detalhe do processo, com a mesma
 * forma do contrato: cada seção aninhada aceita só os campos que o cenário troca. Tipadas pelo DTO,
 * uma mudança do contrato quebra a compilação em vez de quebrar a tela em silêncio.
 */

export interface FaseDoServidorParcial {
  readonly id?: string;
  readonly codigo?: string;
  readonly faseCanonica?: Partial<FaseCronogramaDto['faseCanonica']>;
  readonly cronograma?: Partial<FaseCronogramaDto['cronograma']>;
  readonly publicacoes?: Partial<FaseCronogramaDto['publicacoes']>;
  readonly bancasRequeridas?: FaseCronogramaDto['bancasRequeridas'];
}

export interface EtapaDoServidorParcial {
  readonly id?: string;
  readonly identificacao?: Partial<EtapaProcessoDto['identificacao']>;
  readonly nota?: Partial<EtapaProcessoDto['nota']>;
  readonly avaliacao?: Partial<EtapaProcessoDto['avaliacao']>;
  readonly janela?: Partial<EtapaProcessoDto['janela']>;
  readonly publicacoes?: Partial<EtapaProcessoDto['publicacoes']>;
  readonly bancas?: EtapaProcessoDto['bancas'];
}

const FASE_CANONICA: FaseCronogramaDto['faseCanonica'] = {
  origemId: '01960000-0000-7000-0000-000000000904',
  origemData: 'NO_EDITAL',
  agrupaEtapas: false,
  permiteComplementacao: false,
  coletaInscricao: true,
  coletaSolicitacaoIsencao: false,
};

const CRONOGRAMA_DA_FASE: FaseCronogramaDto['cronograma'] = {
  ordem: 1,
  inicio: '2027-01-01T00:00:00Z',
  fim: '2027-01-31T23:59:59Z',
  faseConcluinteCodigo: null,
  unidadeResponsavel: null,
};

const PUBLICACOES_DA_FASE: FaseCronogramaDto['publicacoes'] = {
  produtos: [],
  produzResultado: false,
  emiteParecerIndividual: false,
  regraRecurso: null,
  tiposDeDecisao: [],
  regraDeHomologacao: null,
};

/** Fase de coleta de inscrição, sem produto, banca nem recurso. */
export function faseDoServidor(parcial: FaseDoServidorParcial = {}): FaseCronogramaDto {
  return {
    id: parcial.id ?? '01960000-0000-7000-0000-000000000a01',
    codigo: parcial.codigo ?? 'INSCRICAO',
    faseCanonica: { ...FASE_CANONICA, ...parcial.faseCanonica },
    cronograma: { ...CRONOGRAMA_DA_FASE, ...parcial.cronograma },
    publicacoes: { ...PUBLICACOES_DA_FASE, ...parcial.publicacoes },
    bancasRequeridas: parcial.bancasRequeridas ?? [],
  };
}

const IDENTIFICACAO_DA_ETAPA: EtapaProcessoDto['identificacao'] = {
  nome: 'Prova objetiva',
  carater: 'classificatoria' as EtapaProcessoDto['identificacao']['carater'],
  tipoEtapa: {
    origemId: '01960000-0000-7000-0000-0000000000b1',
    codigo: 'PROVA_OBJETIVA',
    nome: 'Prova objetiva',
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
    id: parcial.id ?? '01960000-0000-7000-0000-0000000000f1',
    identificacao: { ...IDENTIFICACAO_DA_ETAPA, ...parcial.identificacao },
    nota: { ...NOTA_DA_ETAPA, ...parcial.nota },
    avaliacao: { ...AVALIACAO_DA_ETAPA, ...parcial.avaliacao },
    janela: { inicio: null, fim: null, ...parcial.janela },
    publicacoes: { ...PUBLICACOES_DA_ETAPA, ...parcial.publicacoes },
    bancas: parcial.bancas ?? [],
  };
}

type ProdutoDaFase = FaseCronogramaDto['publicacoes']['produtos'][number];
type UnidadeDaFase = FaseCronogramaDto['cronograma']['unidadeResponsavel'];

/** A mesma fase com mais um ato entre os que ela publica. */
export function comProdutoNaFase(
  fase: FaseCronogramaDto,
  produto: ProdutoDaFase,
): FaseCronogramaDto {
  const produtos = [...fase.publicacoes.produtos, produto];
  return { ...fase, publicacoes: { ...fase.publicacoes, produtos } };
}

/** A mesma fase com a unidade que responde por ela trocada. */
export function comUnidadeNaFase(
  fase: FaseCronogramaDto,
  unidade: UnidadeDaFase,
): FaseCronogramaDto {
  return { ...fase, cronograma: { ...fase.cronograma, unidadeResponsavel: unidade } };
}

/** A mesma fase com os tipos de decisão que ela declara trocados. */
export function comTiposDeDecisaoNaFase(
  fase: FaseCronogramaDto,
  tiposDeDecisao: readonly string[],
): FaseCronogramaDto {
  return { ...fase, publicacoes: { ...fase.publicacoes, tiposDeDecisao: [...tiposDeDecisao] } };
}

/** A mesma etapa com os tipos de decisão que ela declara trocados. */
export function comTiposDeDecisaoNaEtapa(
  etapa: EtapaProcessoDto,
  tiposDeDecisao: readonly string[],
): EtapaProcessoDto {
  return { ...etapa, publicacoes: { ...etapa.publicacoes, tiposDeDecisao: [...tiposDeDecisao] } };
}
