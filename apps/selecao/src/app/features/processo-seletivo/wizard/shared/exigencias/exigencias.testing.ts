import { AplicabilidadeCodigo, FormaDeComprovacaoCodigo } from '@uniplus/shared-data/selecao';
import type {
  DocumentoExigidoDto,
  RegraDeComprovacaoDto,
  ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';

import { regrasDeComprovacaoParaEnvio } from './gravacao-das-exigencias';
import { comExigenciaSemGrupo, exigenciaNova } from './exigencias-documentais';
import { criarIdentificadorDaRegra } from './identificador-da-regra';
import type {
  ExigenciaDeDocumento,
  ExigenciasDoRascunho,
  RegraDeComprovacao,
} from '../../processo-seletivo.models';

export const ID_ISENCAO = '01960000-0000-7000-0000-0000000000f1';
export const ID_HABILITACAO = '01960000-0000-7000-0000-0000000000f2';
export const ID_ETAPA_RENDA = '01960000-0000-7000-0000-0000000000e1';
export const ID_RG = '01960000-0000-7000-0000-0000000000d1';
export const ID_CONTRACHEQUE = '01960000-0000-7000-0000-0000000000d2';
export const ID_DIPLOMA = '01960000-0000-7000-0000-0000000000d3';

/** As etapas que o processo tem hoje — é contra elas que a exigência aponta. */
export const ETAPAS_VIVAS = new Set([ID_ETAPA_RENDA]);

export const FASES = new Map([
  ['ISENCAO', ID_ISENCAO],
  ['HABILITACAO', ID_HABILITACAO],
]);

/** A fase da isenção responde dois formulários, o da inscrição e o do pedido; a de habilitação, só o dela. */
export const FORMULARIOS_POR_FASE: ReadonlyMap<string, readonly string[]> = new Map([
  ['ISENCAO', ['INSCRICAO', 'ISENCAO_TAXA']],
  ['HABILITACAO', ['HABILITACAO']],
]);

/** O cadastro de tipos de documento, de onde saem formato aceito e tamanho máximo. */
export const RESTRICAO_RG = { formatosAceitos: 'PDF,JPEG,PNG', tamanhoMaximoMb: 5 };

export function exigencia(patch: Partial<ExigenciaDeDocumento> = {}): ExigenciaDeDocumento {
  return { ...exigenciaNova(ID_RG, 'HABILITACAO', RESTRICAO_RG), ...patch };
}

export function rascunho(...exigencias: readonly ExigenciaDeDocumento[]): ExigenciasDoRascunho {
  return exigencias.reduce<ExigenciasDoRascunho>(
    (acumulado, atual) => comExigenciaSemGrupo(acumulado, atual),
    { regrasDeComprovacao: [], emTodasAsFases: [] },
  );
}

export function comando(
  rascunhoDado: ExigenciasDoRascunho,
  modalidades: readonly string[] = ['AC'],
) {
  return regrasDeComprovacaoParaEnvio(rascunhoDado, {
    faseIdPorCodigo: FASES,
    modalidadesOfertadas: modalidades,
    etapasVivas: ETAPAS_VIVAS,
    formulariosPorFase: FORMULARIOS_POR_FASE,
  }).regras;
}

const REGRA_SEM_DADOS: Omit<RegraDeComprovacao, 'forma' | 'identificadorNoRascunho'> = {
  documento: null,
  quantidadeMinima: null,
  consequencia: null,
  abrePrazoParaReenvio: false,
  basesLegais: null,
  itens: null,
  criterioDeDistincao: null,
  dataReferencia: null,
  ocorrenciasEsperadas: null,
  grupoDoFormularioParaRepeticao: null,
};

/** Um regra sem nada além do tipo; o que o teste declara em `alteracoes` é o que importa nele. */
export function regraDoRascunho(
  alteracoes: Partial<RegraDeComprovacao> & Pick<RegraDeComprovacao, 'forma'>,
): RegraDeComprovacao {
  return {
    ...REGRA_SEM_DADOS,
    identificadorNoRascunho: criarIdentificadorDaRegra(),
    ...alteracoes,
  };
}

export function detalheDaApi(
  regrasDeComprovacao: readonly RegraDeComprovacaoDto[],
): ProcessoSeletivoDto {
  return {
    cronogramaFases: [
      { id: ID_ISENCAO, codigo: 'ISENCAO' },
      { id: ID_HABILITACAO, codigo: 'HABILITACAO' },
    ],
    regrasDeComprovacao: regrasDeComprovacao,
  } as unknown as ProcessoSeletivoDto;
}

export interface AlteracoesDoDocumentoDaApi {
  readonly fatosComprovados?: readonly string[];
  readonly faseId?: string;
  readonly etapaId?: string | null;
  readonly formularioCodigo?: string | null;
  readonly aplicabilidade?: DocumentoExigidoDto['aplicabilidade'];
  readonly indeferimento?: Partial<DocumentoExigidoDto['indeferimento']>;
  readonly requisitos?: Partial<DocumentoExigidoDto['requisitos']>;
}

export function exigenciaDaApi(alteracoes: AlteracoesDoDocumentoDaApi = {}): RegraDeComprovacaoDto {
  return {
    id: 'no-1',
    forma: { codigo: FormaDeComprovacaoCodigo.DOCUMENTO, rotulo: 'Documento' },
    cardinalidade: { quantidadeMinima: null, distincao: null },
    indeferimento: {
      consequenciaDoDescumprimento: null,
      basesLegais: [],
      abrePrazoParaReenvio: false,
    },
    itens: [],
    grupoDoFormularioParaRepeticao: null,
    documento: documentoDaApi(alteracoes),
  };
}

export function grupoDaApi(itens: RegraDeComprovacaoDto[]): RegraDeComprovacaoDto {
  return {
    ...exigenciaDaApi(),
    forma: { codigo: FormaDeComprovacaoCodigo.TODOS_OS_ITENS, rotulo: 'Todos' },
    documento: null,
    itens,
  };
}

const TIPO_RG: DocumentoExigidoDto['tipoDocumento'] = {
  id: ID_RG,
  codigo: 'RG',
  nome: 'RG',
  categoria: 'IDENTIFICACAO',
  protecao: {
    classificacao: 'PESSOAL',
    finalidade: 'COMPROVAR_IDENTIDADE',
    hipoteseLegal: 'OBRIGACAO_LEGAL',
  },
};

const INDEFERIMENTO_PADRAO: DocumentoExigidoDto['indeferimento'] = {
  obrigatorio: true,
  consequenciaDoDescumprimento: null,
  basesLegais: [],
  abrePrazoParaReenvio: false,
};

const REQUISITOS_PADRAO = {
  formatosPermitidos: 'QUALQUER',
  tamanhoMaximoBytes: null,
  prazoDeEmissao: null,
  validade: null,
  modelo: null,
};

const APLICABILIDADE_GERAL = {
  tipo: { codigo: AplicabilidadeCodigo.GERAL, rotulo: 'Geral' },
  condicoes: [],
};

function documentoDaApi(alteracoes: AlteracoesDoDocumentoDaApi): DocumentoExigidoDto {
  return {
    id: 'doc-1',
    chave: 'doc-1',
    tipoDocumento: TIPO_RG,
    momento: momentoDaApi(alteracoes),
    aplicabilidade: alteracoes.aplicabilidade ?? APLICABILIDADE_GERAL,
    indeferimento: { ...INDEFERIMENTO_PADRAO, ...alteracoes.indeferimento },
    requisitos: {
      ...REQUISITOS_PADRAO,
      ...alteracoes.requisitos,
    } as unknown as DocumentoExigidoDto['requisitos'],
    fatosComprovados: alteracoes.fatosComprovados ?? [],
  };
}

function momentoDaApi(alteracoes: AlteracoesDoDocumentoDaApi): DocumentoExigidoDto['momento'] {
  return {
    faseId: alteracoes.faseId ?? ID_HABILITACAO,
    etapaId: alteracoes.etapaId ?? null,
    formularioCodigo: alteracoes.formularioCodigo ?? null,
  };
}
