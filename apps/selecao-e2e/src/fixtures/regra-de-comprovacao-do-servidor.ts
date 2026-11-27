import { valorDoEnum } from './valor-do-enum';
import type { DocumentoExigidoDto, RegraDeComprovacaoDto } from '@uniplus/shared-data/selecao';
import type { JsonDaApi } from '@uniplus/shared-e2e';

export type RegraDaExigencia = JsonDaApi<RegraDeComprovacaoDto>;
type DocumentoDaExigencia = JsonDaApi<DocumentoExigidoDto>;

export interface DocumentoDaRegra {
  readonly id: string;
  readonly faseId: string;
  readonly tipoDocumento: Pick<DocumentoDaExigencia['tipoDocumento'], 'id' | 'codigo' | 'nome'>;
  readonly obrigatorio: boolean;
  readonly consequenciaDoDescumprimento: NonNullable<
    DocumentoDaExigencia['indeferimento']['consequenciaDoDescumprimento']
  >['codigo'];
  readonly condicoes?: DocumentoDaExigencia['aplicabilidade']['condicoes'];
}

const ROTULOS_DAS_CONSEQUENCIAS: Record<DocumentoDaRegra['consequenciaDoDescumprimento'], string> =
  {
    ELIMINA_DO_PROCESSO: 'Elimina do processo',
    RETIRA_A_MODALIDADE: 'Retira a modalidade',
    RETIRA_O_ACRESCIMO: 'Retira o acréscimo',
  };

const BASE_LEGAL_DO_EDITAL = {
  referencia: 'Edital nº 1/2027, Anexo III',
  abrangencia: valorDoEnum('INTERNA_EDITAL', 'Edital'),
  situacao: valorDoEnum('RESOLVIDO', 'Resolvido'),
  observacao: null,
};

const PROTECAO_DO_DOCUMENTO: DocumentoDaExigencia['tipoDocumento']['protecao'] = {
  classificacao: 'PESSOAL',
  finalidade: 'Comprovar a condição declarada na inscrição.',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
};

const REQUISITOS_DO_ARQUIVO = {
  formatosPermitidos: [{ formato: 'PDF', tamanhoMaximoBytesMax: null }],
  tamanhoMaximoBytes: 10485760,
  prazoDeEmissao: null,
  validade: null,
  modelo: null,
};

function indeferimentoDoDocumento(regra: DocumentoDaRegra): DocumentoDaExigencia['indeferimento'] {
  return {
    obrigatorio: regra.obrigatorio,
    consequenciaDoDescumprimento: valorDoEnum(
      regra.consequenciaDoDescumprimento,
      ROTULOS_DAS_CONSEQUENCIAS[regra.consequenciaDoDescumprimento],
    ),
    basesLegais: [{ id: `${regra.id}-norma`, ...BASE_LEGAL_DO_EDITAL }],
    abrePrazoParaReenvio: false,
  };
}

function aplicabilidadeDoDocumento(
  regra: DocumentoDaRegra,
): DocumentoDaExigencia['aplicabilidade'] {
  const condicoes = regra.condicoes ?? [];
  const tipo =
    condicoes.length === 0
      ? valorDoEnum('GERAL', 'Geral')
      : valorDoEnum('CONDICIONAL', 'Condicional');
  return { tipo, condicoes };
}

function tipoDoDocumento(regra: DocumentoDaRegra): DocumentoDaExigencia['tipoDocumento'] {
  return { ...regra.tipoDocumento, categoria: 'IDENTIFICACAO', protecao: PROTECAO_DO_DOCUMENTO };
}

function documentoDaRegra(regra: DocumentoDaRegra): DocumentoDaExigencia {
  return {
    id: `${regra.id}-doc`,
    chave: `${regra.id}-doc`,
    tipoDocumento: tipoDoDocumento(regra),
    momento: { faseId: regra.faseId, etapaId: null, formularioCodigo: null },
    aplicabilidade: aplicabilidadeDoDocumento(regra),
    indeferimento: indeferimentoDoDocumento(regra),
    requisitos: REQUISITOS_DO_ARQUIVO,
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
    indeferimento: {
      consequenciaDoDescumprimento: null,
      basesLegais: [],
      abrePrazoParaReenvio: false,
    },
    itens: [],
    grupoDoFormularioParaRepeticao: null,
  };
}
