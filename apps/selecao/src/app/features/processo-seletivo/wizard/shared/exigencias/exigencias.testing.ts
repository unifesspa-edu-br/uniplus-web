import { FormaDeComprovacaoCodigo } from '@uniplus/shared-data/selecao';
import type {
  DocumentoExigidoDto,
  RegraDeComprovacaoDto,
  ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';

import { regrasDeComprovacaoParaEnvio } from './gravacao-das-exigencias';
import { comExigencia, exigenciaNova } from './exigencias-documentais';
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

/** A fase da isenção divide o formulário com a inscrição; a de habilitação responde só o dela. */
export const FINALIDADES_POR_FASE: ReadonlyMap<string, readonly string[]> = new Map([
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
    (acumulado, atual) => comExigencia(acumulado, atual),
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
    finalidadesPorFase: FINALIDADES_POR_FASE,
  });
}

const NO_SEM_NADA: Omit<RegraDeComprovacao, 'forma'> = {
  documento: null,
  quantidadeMinima: null,
  consequencia: null,
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
  return { ...NO_SEM_NADA, ...alteracoes };
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
  readonly faseId?: string;
  readonly etapaId?: string | null;
  readonly finalidade?: string | null;
  readonly aplicabilidade?: DocumentoExigidoDto['aplicabilidade'];
  readonly indeferimento?: Partial<DocumentoExigidoDto['indeferimento']>;
  readonly requisitos?: Partial<DocumentoExigidoDto['requisitos']>;
}

export function exigenciaDaApi(alteracoes: AlteracoesDoDocumentoDaApi = {}): RegraDeComprovacaoDto {
  return {
    id: 'no-1',
    forma: { codigo: FormaDeComprovacaoCodigo.DOCUMENTO, rotulo: 'Documento' },
    cardinalidade: { quantidadeMinima: null, distincao: null },
    indeferimento: { consequencia: null, basesLegais: [] },
    itens: [],
    grupoDoFormularioParaRepeticao: null,
    documento: documentoDaApi(alteracoes),
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
  consequencia: null,
  basesLegais: [],
};

const REQUISITOS_PADRAO: DocumentoExigidoDto['requisitos'] = {
  formatosPermitidos: 'QUALQUER',
  tamanhoMaximoBytes: null,
  idadeMaximaEmissao: null,
  modelo: null,
};

function documentoDaApi(alteracoes: AlteracoesDoDocumentoDaApi): DocumentoExigidoDto {
  return {
    id: 'doc-1',
    tipoDocumento: TIPO_RG,
    momento: {
      faseId: alteracoes.faseId ?? ID_HABILITACAO,
      etapaId: alteracoes.etapaId ?? null,
      finalidade: alteracoes.finalidade ?? null,
    },
    aplicabilidade: alteracoes.aplicabilidade ?? { tipo: 'GERAL', condicoes: [] },
    indeferimento: { ...INDEFERIMENTO_PADRAO, ...alteracoes.indeferimento },
    requisitos: { ...REQUISITOS_PADRAO, ...alteracoes.requisitos },
    fatosComprovados: [],
  };
}
