import type { DocumentoExigidoDto, NoExigenciaDto } from '@uniplus/shared-data/selecao';
import type { JsonDaApi } from '@uniplus/shared-e2e';

export type NoDaExigencia = JsonDaApi<NoExigenciaDto>;
type DocumentoDaExigencia = JsonDaApi<DocumentoExigidoDto>;

export interface FolhaDaExigencia {
  readonly id: string;
  readonly faseId: string;
  readonly tipoDocumento: Pick<DocumentoDaExigencia['tipoDocumento'], 'id' | 'codigo' | 'nome'>;
  readonly obrigatorio: boolean;
  readonly consequencia: string;
  readonly condicoes?: DocumentoDaExigencia['aplicabilidade']['condicoes'];
}

const BASE_LEGAL_DO_EDITAL = {
  referencia: 'Edital nº 1/2027, Anexo III',
  abrangencia: 'INTERNA_EDITAL',
  status: 'RESOLVIDO',
  observacao: null,
};

const PROTECAO_DO_DOCUMENTO: DocumentoDaExigencia['tipoDocumento']['protecao'] = {
  classificacao: 'PESSOAL',
  finalidade: 'Comprovar a condição declarada na inscrição.',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
};

const REQUISITOS_DO_ARQUIVO: DocumentoDaExigencia['requisitos'] = {
  formatosPermitidos: ['pdf'],
  tamanhoMaximoBytes: 10485760,
  idadeMaximaEmissao: null,
  modelo: null,
};

function indeferimentoDaFolha(folha: FolhaDaExigencia): DocumentoDaExigencia['indeferimento'] {
  return {
    obrigatorio: folha.obrigatorio,
    consequencia: folha.consequencia,
    basesLegais: [{ id: `${folha.id}-norma`, ...BASE_LEGAL_DO_EDITAL }],
  };
}

function aplicabilidadeDaFolha(folha: FolhaDaExigencia): DocumentoDaExigencia['aplicabilidade'] {
  const condicoes = folha.condicoes ?? [];
  return { tipo: condicoes.length === 0 ? 'GERAL' : 'CONDICIONAL', condicoes };
}

function documentoDaFolha(folha: FolhaDaExigencia): DocumentoDaExigencia {
  return {
    id: `${folha.id}-doc`,
    tipoDocumento: {
      ...folha.tipoDocumento,
      categoria: 'IDENTIFICACAO',
      protecao: PROTECAO_DO_DOCUMENTO,
    },
    momento: { faseId: folha.faseId, etapaId: null, finalidade: null },
    aplicabilidade: aplicabilidadeDaFolha(folha),
    indeferimento: indeferimentoDaFolha(folha),
    requisitos: REQUISITOS_DO_ARQUIVO,
    fatosComprovados: [],
  };
}

/** A exigência de um documento como folha da árvore que o detalhe do processo devolve. */
export function folhaDaExigencia(folha: FolhaDaExigencia): NoDaExigencia {
  return {
    id: folha.id,
    tipo: 'FOLHA',
    documento: documentoDaFolha(folha),
    cardinalidade: { quantidadeMinima: null, distincao: null },
    indeferimento: { consequencia: null, basesLegais: [] },
    filhos: [],
    repetePorEntidade: null,
  };
}
