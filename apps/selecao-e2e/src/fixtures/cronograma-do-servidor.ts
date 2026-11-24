import { CaraterEtapaCodigo } from '@uniplus/shared-data/selecao';
import { ORIGEM_NO_EDITAL, valorDoEnum } from './valor-do-enum';
import type {
  EtapaProcessoDto,
  FaseCronogramaDto,
  TipoMotivoDeDecisaoCodigo,
} from '@uniplus/shared-data/selecao';
import type { TipoDeBancaDoCatalogo } from './tipos-de-banca';
import { VOCABULARIO_DE_TIPOS_DE_DECISAO } from '../support/vocabulario-de-tipos-de-decisao';

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
  origemData: ORIGEM_NO_EDITAL,
  agrupaEtapas: false,
  permiteComplementacao: false,
  coletaInscricao: true,
  coletaSolicitacaoIsencao: false,
};

const CRONOGRAMA_DA_FASE: FaseCronogramaDto['cronograma'] = {
  ordem: 1,
  inicio: '2027-01-01T00:00:00Z',
  fim: '2027-01-31T23:59:59Z',
  noMesmoMomentoDaAnterior: false,
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
  carater: valorDoEnum(CaraterEtapaCodigo.classificatoria, 'Classificatória'),
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

type ParametrosDoRecursoDoServidor = NonNullable<
  FaseCronogramaDto['publicacoes']['regraRecurso']
>['parametros'];

/** Os parâmetros de um recurso sem instância superior, como o servidor os devolve na leitura. */
export const PARAMETROS_DO_RECURSO_DO_SERVIDOR: ParametrosDoRecursoDoServidor = {
  prazoValor: 2,
  prazoUnidade: { codigo: 'diasUteis', rotulo: 'Dias úteis' },
  admiteInstanciaSuperior: false,
  prazoSegundaInstanciaValor: null,
  prazoSegundaInstanciaUnidade: null,
  efeitoSuspensivo: { codigo: 'semEfeitoSuspensivo', rotulo: 'Sem efeito suspensivo' },
  guardaDaVaga: {
    codigo: 'ateOResultadoDefinitivo',
    rotulo: 'Guarda a vaga até o resultado definitivo',
  },
} as ParametrosDoRecursoDoServidor;

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

/** Os tipos como o servidor os devolve: o código e o rótulo, que aqui repete o código. */
function tiposDoServidor(
  codigos: readonly string[],
): FaseCronogramaDto['publicacoes']['tiposDeDecisao'] {
  return codigos.map((codigo) => ({
    codigo: codigo as TipoMotivoDeDecisaoCodigo,
    rotulo:
      VOCABULARIO_DE_TIPOS_DE_DECISAO.find((tipo) => tipo.codigo === codigo)?.rotulo ??
      'Tipo de decisão não identificado',
  }));
}

/** A mesma fase com os tipos de decisão que ela declara trocados. */
export function comTiposDeDecisaoNaFase(
  fase: FaseCronogramaDto,
  tiposDeDecisao: readonly string[],
): FaseCronogramaDto {
  return {
    ...fase,
    publicacoes: { ...fase.publicacoes, tiposDeDecisao: tiposDoServidor(tiposDeDecisao) },
  };
}

/** A mesma etapa com os tipos de decisão que ela declara trocados. */
export function comTiposDeDecisaoNaEtapa(
  etapa: EtapaProcessoDto,
  tiposDeDecisao: readonly string[],
): EtapaProcessoDto {
  return {
    ...etapa,
    publicacoes: { ...etapa.publicacoes, tiposDeDecisao: tiposDoServidor(tiposDeDecisao) },
  };
}

type BancaDaEtapaLida = EtapaProcessoDto['bancas'][number];
type BancaDaFaseLida = FaseCronogramaDto['bancasRequeridas'][number];

/** O que a banca guarda do tipo ao ser criada: a origem, o código, o nome, o papel e as marcas. */
function copiaDoTipoNaBanca(tipo: TipoDeBancaDoCatalogo) {
  return {
    tipoBancaOrigemId: tipo.id,
    codigo: tipo.codigo,
    nome: tipo.nome,
    papel: tipo.papel,
    exigeDuasOuMaisBancas: tipo.exigeDuasOuMaisBancas,
    encerraRecursoNaPrimeiraInstancia: tipo.encerraRecursoNaPrimeiraInstancia,
    tiposDeDecisaoJulgados: tipo.tiposDeDecisaoJulgados,
  };
}

/** A banca da etapa como a leitura a devolve: a cópia do tipo, a posição e a regra declarada. */
export function bancaDaEtapaDoServidor(
  tipo: TipoDeBancaDoCatalogo,
  parcial: Partial<BancaDaEtapaLida> = {},
): BancaDaEtapaLida {
  return {
    id: '01a0d640-0000-7000-8000-00000000b001',
    ...copiaDoTipoNaBanca(tipo),
    posicaoNoTipo: 1,
    regraDeDeliberacao: null,
    ...parcial,
  };
}

/** O id de uma banca que já foi gravada, pela ordem em que o cenário a conta. */
export function idDaBancaGravada(ordem: number): string {
  return `01a0d640-0000-7000-8000-00000000e${String(ordem).padStart(3, '0')}`;
}

/** A banca da fase como a leitura a devolve, sem candidatos atendidos definidos. */
export function bancaDaFaseDoServidor(
  tipo: TipoDeBancaDoCatalogo,
  parcial: Partial<BancaDaFaseLida> = {},
): BancaDaFaseLida {
  return { ...bancaDaEtapaDoServidor(tipo), candidatosAtendidos: [], ...parcial };
}

/** A mesma fase com as bancas que ela requer trocadas. */
export function comBancasNaFase(
  fase: FaseCronogramaDto,
  bancasRequeridas: FaseCronogramaDto['bancasRequeridas'],
): FaseCronogramaDto {
  return { ...fase, bancasRequeridas };
}

/** A mesma etapa com as bancas que a julgam trocadas. */
export function comBancasNaEtapa(
  etapa: EtapaProcessoDto,
  bancas: EtapaProcessoDto['bancas'],
): EtapaProcessoDto {
  return { ...etapa, bancas };
}
