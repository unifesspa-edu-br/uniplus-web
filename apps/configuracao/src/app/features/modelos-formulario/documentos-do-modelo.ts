import type {
  ConteudoDoModeloInput,
  ModeloFormularioView,
} from '@uniplus/shared-data/configuracao';
import {
  ConsequenciaDoDescumprimentoCodigo,
  TipoAbrangenciaCodigo,
  StatusBaseLegalCodigo,
  EfeitoNaAnaliseDoDocumentoCodigo,
  EscolhaDaValidadeCodigo,
  EscolhaDoPrazoDeEmissaoCodigo,
  TipoDaDataDeReferenciaCodigo,
  UnidadeDoPrazoDeEmissaoCodigo,
} from '@uniplus/shared-data/configuracao';
import { codigoDoContrato, codigoExigidoDoContrato } from '@uniplus/shared-data/utils';
import type {
  BaseLegalDoDocumento,
  DataDeReferenciaDoDocumento,
  DocumentoExigidoDoFormulario,
  PrazoDeEmissaoDoDocumento,
  RequisitosDoDocumento,
  ValidadeDoDocumento,
} from '@uniplus/shared-inscricao/formulario';

type DocumentoDoConteudo =
  ModeloFormularioView['conteudo']['conjuntoDeDocumentos']['documentosExigidos'][number];
type DocumentoParaOConteudo = NonNullable<
  NonNullable<ConteudoDoModeloInput['conjuntoDeDocumentos']>['documentosExigidos']
>[number];
type IndeferimentoDoModelo = DocumentoDoConteudo['indeferimento'];
type RequisitosDoModelo = DocumentoDoConteudo['requisitos'];
type RequisitosParaOModelo = NonNullable<DocumentoParaOConteudo['requisitos']>;
type ReferenciaDoModelo = NonNullable<NonNullable<RequisitosDoModelo['validade']>['referencia']>;
type ReferenciaParaOModelo = NonNullable<
  NonNullable<RequisitosParaOModelo['validade']>['referencia']
>;

const codigoDe = (escolha: { readonly codigo: string } | null): string | null =>
  escolha?.codigo ?? null;

function referenciaDoModelo(
  referencia: ReferenciaDoModelo | null,
): DataDeReferenciaDoDocumento | null {
  return (
    referencia && {
      tipo: referencia.tipo.codigo,
      data: referencia.data,
      faseCodigo: referencia.faseCodigo,
    }
  );
}

type PrazoDoModelo = NonNullable<RequisitosDoModelo['prazoDeEmissao']>;
type ValidadeDoModelo = NonNullable<RequisitosDoModelo['validade']>;

function prazoDoModelo(prazo: PrazoDoModelo): PrazoDeEmissaoDoDocumento {
  return {
    escolha: prazo.escolha.codigo,
    valor: prazo.valor,
    unidade: codigoDe(prazo.unidade),
    referencia: referenciaDoModelo(prazo.referencia),
    efeitoForaDoPrazo: codigoDe(prazo.efeitoForaDoPrazo),
  };
}

function validadeDoModelo(validade: ValidadeDoModelo): ValidadeDoDocumento {
  return {
    escolha: validade.escolha.codigo,
    referencia: referenciaDoModelo(validade.referencia),
    efeitoDoVencimento: codigoDe(validade.efeitoDoVencimento),
  };
}

/** Os requisitos que o modelo devolve (código e rótulo), na forma do editor: só o código. */
function requisitosDoModelo({
  prazoDeEmissao,
  validade,
}: RequisitosDoModelo): RequisitosDoDocumento {
  return {
    prazoDeEmissao: prazoDeEmissao && prazoDoModelo(prazoDeEmissao),
    validade: validade && validadeDoModelo(validade),
  };
}

function referenciaParaOModelo(
  referencia: DataDeReferenciaDoDocumento | null,
): ReferenciaParaOModelo | null {
  return (
    referencia && {
      tipo: codigoDoContrato(TipoDaDataDeReferenciaCodigo, referencia.tipo ?? ''),
      data: referencia.data,
      faseCodigo: referencia.faseCodigo,
    }
  );
}

type PrazoParaOModelo = NonNullable<RequisitosParaOModelo['prazoDeEmissao']>;
type ValidadeParaOModelo = NonNullable<RequisitosParaOModelo['validade']>;

function prazoParaOModelo(prazo: PrazoDeEmissaoDoDocumento): PrazoParaOModelo {
  return {
    escolha: codigoDoContrato(EscolhaDoPrazoDeEmissaoCodigo, prazo.escolha ?? ''),
    valor: prazo.valor,
    unidade: codigoDoContrato(UnidadeDoPrazoDeEmissaoCodigo, prazo.unidade ?? ''),
    referencia: referenciaParaOModelo(prazo.referencia),
    efeitoForaDoPrazo: codigoDoContrato(
      EfeitoNaAnaliseDoDocumentoCodigo,
      prazo.efeitoForaDoPrazo ?? '',
    ),
  };
}

function validadeParaOModelo(validade: ValidadeDoDocumento): ValidadeParaOModelo {
  return {
    escolha: codigoDoContrato(EscolhaDaValidadeCodigo, validade.escolha ?? ''),
    referencia: referenciaParaOModelo(validade.referencia),
    efeitoDoVencimento: codigoDoContrato(
      EfeitoNaAnaliseDoDocumentoCodigo,
      validade.efeitoDoVencimento ?? '',
    ),
  };
}

/** Os requisitos do editor, com cada código no membro do enum que o modelo grava. */
function requisitosParaOModelo(
  requisitos: RequisitosDoDocumento | null | undefined,
): RequisitosParaOModelo | null {
  if (!requisitos) return null;
  const { prazoDeEmissao, validade } = requisitos;
  return {
    prazoDeEmissao: prazoDeEmissao && prazoParaOModelo(prazoDeEmissao),
    validade: validade && validadeParaOModelo(validade),
  };
}

interface ComIndeferimento {
  readonly indeferimento: IndeferimentoDoModelo;
  readonly requisitos: RequisitosDoModelo;
}

type DesdobradoParaOEditor<D extends ComIndeferimento> = Omit<D, keyof ComIndeferimento> &
  Pick<
    DocumentoExigidoDoFormulario,
    | 'obrigatorio'
    | 'consequenciaDoDescumprimento'
    | 'abrePrazoParaReenvio'
    | 'basesLegais'
    | 'requisitos'
  >;

/** O documento como o editor o edita: o bloco do indeferimento desdobrado em campos. */
export function documentoDoModelo<D extends ComIndeferimento>(
  documento: D,
): DesdobradoParaOEditor<D> {
  const { indeferimento, requisitos, ...demais } = documento;
  return {
    ...demais,
    obrigatorio: indeferimento.obrigatorio,
    consequenciaDoDescumprimento: indeferimento.consequenciaDoDescumprimento,
    abrePrazoParaReenvio: indeferimento.abrePrazoParaReenvio,
    basesLegais: indeferimento.basesLegais,
    requisitos: requisitosDoModelo(requisitos),
  };
}

type AgrupadoParaOModelo<O> = Omit<
  DocumentoExigidoDoFormulario<O>,
  | 'obrigatorio'
  | 'consequenciaDoDescumprimento'
  | 'abrePrazoParaReenvio'
  | 'basesLegais'
  | 'requisitos'
> &
  Pick<DocumentoParaOConteudo, 'indeferimento' | 'requisitos'>;

/** O documento do editor como o modelo o grava: o indeferimento volta a ser um bloco. */
export function documentoParaOModelo<O>(
  documento: DocumentoExigidoDoFormulario<O>,
): AgrupadoParaOModelo<O> {
  const { obrigatorio, requisitos, ...demais } = documento;
  const { consequenciaDoDescumprimento, abrePrazoParaReenvio, basesLegais, ...restante } = demais;
  const indeferimento = { consequenciaDoDescumprimento, abrePrazoParaReenvio, basesLegais };
  return {
    ...restante,
    indeferimento: { obrigatorio, ...indeferimentoParaOModelo(indeferimento) },
    requisitos: requisitosParaOModelo(requisitos),
  };
}

function consequenciaParaOModelo(consequencia: string | null) {
  return consequencia === null
    ? null
    : codigoExigidoDoContrato(ConsequenciaDoDescumprimentoCodigo, consequencia, 'documento');
}

export function indeferimentoParaOModelo({
  consequenciaDoDescumprimento,
  basesLegais,
  abrePrazoParaReenvio,
}: {
  readonly consequenciaDoDescumprimento: string | null;
  readonly basesLegais: readonly BaseLegalDoDocumento[] | null;
  readonly abrePrazoParaReenvio: boolean;
}) {
  return {
    consequenciaDoDescumprimento: consequenciaParaOModelo(consequenciaDoDescumprimento),
    basesLegais: basesLegais?.map(baseLegalParaOModelo) ?? null,
    abrePrazoParaReenvio,
  };
}

function baseLegalParaOModelo(base: BaseLegalDoDocumento) {
  return {
    ...base,
    abrangencia: codigoExigidoDoContrato(TipoAbrangenciaCodigo, base.abrangencia, 'abrangência'),
    situacao: codigoExigidoDoContrato(StatusBaseLegalCodigo, base.situacao, 'situação'),
  };
}
