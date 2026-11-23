import type { DocumentoExigidoDto, RegraDeComprovacaoDto } from '@uniplus/shared-data/selecao';
import type { JsonDaApi } from '@uniplus/shared-e2e';

export type RegraDaExigencia = JsonDaApi<RegraDeComprovacaoDto>;
type DocumentoDaExigencia = JsonDaApi<DocumentoExigidoDto>;

export interface DocumentoDaRegra {
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
  situacao: 'RESOLVIDO',
  observacao: null,
};

const PROTECAO_DO_DOCUMENTO: DocumentoDaExigencia['tipoDocumento']['protecao'] = {
  classificacao: 'PESSOAL',
  finalidade: 'Comprovar a condição declarada na inscrição.',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
};

const REQUISITOS_DO_ARQUIVO = {
  formatosPermitidos: ['pdf'],
  tamanhoMaximoBytes: 10485760,
  prazoDeEmissao: null,
  validade: null,
  modelo: null,
};

function indeferimentoDoDocumento(regra: DocumentoDaRegra): DocumentoDaExigencia['indeferimento'] {
  return {
    obrigatorio: regra.obrigatorio,
    consequencia: regra.consequencia,
    basesLegais: [{ id: `${regra.id}-norma`, ...BASE_LEGAL_DO_EDITAL }],
  };
}

function aplicabilidadeDoDocumento(
  regra: DocumentoDaRegra,
): DocumentoDaExigencia['aplicabilidade'] {
  const condicoes = regra.condicoes ?? [];
  return { tipo: condicoes.length === 0 ? 'GERAL' : 'CONDICIONAL', condicoes };
}

function documentoDaRegra(regra: DocumentoDaRegra): DocumentoDaExigencia {
  return {
    id: `${regra.id}-doc`,
    tipoDocumento: {
      ...regra.tipoDocumento,
      categoria: 'IDENTIFICACAO',
      protecao: PROTECAO_DO_DOCUMENTO,
    },
    momento: { faseId: regra.faseId, etapaId: null, finalidade: null },
    aplicabilidade: aplicabilidadeDoDocumento(regra),
    indeferimento: indeferimentoDoDocumento(regra),
    requisitos: REQUISITOS_DO_ARQUIVO as unknown as DocumentoDaExigencia['requisitos'],
    fatosComprovados: [],
  };
}

/** A regra de documento devolvida no detalhe do processo. */
export function regraDaExigencia(regra: DocumentoDaRegra): RegraDaExigencia {
  return {
    id: regra.id,
    forma: { codigo: 'DOCUMENTO', rotulo: 'Documento' },
    documento: documentoDaRegra(regra),
    cardinalidade: { quantidadeMinima: null, distincao: null },
    indeferimento: { consequencia: null, basesLegais: [] },
    itens: [],
    grupoDoFormularioParaRepeticao: null,
  };
}
