import {
  EscolhaDoPrazoDeEmissaoCodigo,
  EscolhaDaValidadeCodigo,
  UnidadeDoPrazoDeEmissaoCodigo,
  TipoDaDataDeReferenciaCodigo,
  EfeitoNaAnaliseDoDocumentoCodigo,
  type DocumentoExigidoDto,
  type ItemDocumentoExigidoInput,
} from '@uniplus/shared-data/selecao';
import { codigoDoContrato } from '@uniplus/shared-data/utils';
type RequisitosDto = DocumentoExigidoDto['requisitos'];
type RequisitosInput = NonNullable<ItemDocumentoExigidoInput['requisitos']>;
type PrazoDeEmissaoDto = RequisitosDto['prazoDeEmissao'];
type ValidadeDoDocumentoDto = RequisitosDto['validade'];
type DataDeReferenciaDoDocumentoDto = NonNullable<PrazoDeEmissaoDto>['referencia'];
type DataDeReferenciaDoDocumentoInput = NonNullable<
  NonNullable<RequisitosInput['prazoDeEmissao']>['referencia']
>;
import type { CriteriosDoComprovante, ReferenciaDoDocumento } from '../../processo-seletivo.models';

function lerReferencia(
  referencia: DataDeReferenciaDoDocumentoDto | null,
  codigos: ReadonlyMap<string, string>,
): ReferenciaDoDocumento | null {
  if (referencia === null) return null;
  const faseId = referencia.faseId;
  return {
    tipo: referencia.tipo?.codigo ?? null,
    data: referencia.data,
    faseCodigo: faseId === null ? null : (codigos.get(faseId) ?? null),
    faseIdLido: faseId !== null && !codigos.has(faseId) ? faseId : null,
  };
}

function lerPrazo(
  prazo: PrazoDeEmissaoDto | null | undefined,
  codigos: ReadonlyMap<string, string>,
) {
  if (prazo == null) return null;
  return {
    escolha: prazo.escolha.codigo,
    valor: prazo.valor,
    unidade: prazo.unidade?.codigo ?? null,
    referencia: lerReferencia(prazo.referencia, codigos),
    efeitoForaDoPrazo: prazo.efeitoForaDoPrazo?.codigo ?? null,
  };
}

function lerValidade(
  validade: ValidadeDoDocumentoDto | null | undefined,
  codigos: ReadonlyMap<string, string>,
) {
  if (validade == null) return null;
  return {
    escolha: validade.escolha.codigo,
    referencia: lerReferencia(validade.referencia, codigos),
    efeitoDoVencimento: validade.efeitoDoVencimento?.codigo ?? null,
  };
}

export function lerPrazoEValidade(
  requisitos: Pick<RequisitosDto, 'prazoDeEmissao' | 'validade'>,
  codigos: ReadonlyMap<string, string>,
): Pick<CriteriosDoComprovante, 'prazoDeEmissao' | 'validade'> {
  return {
    prazoDeEmissao: lerPrazo(requisitos.prazoDeEmissao, codigos),
    validade: lerValidade(requisitos.validade, codigos),
  };
}

function referenciaParaEnvio(
  referencia: ReferenciaDoDocumento | null,
  fases: ReadonlyMap<string, string>,
): DataDeReferenciaDoDocumentoInput | null {
  if (referencia === null) return null;
  const faseId =
    referencia.faseCodigo === null
      ? (referencia.faseIdLido ?? null)
      : (fases.get(referencia.faseCodigo) ?? null);
  return {
    tipo: codigoDoContrato(TipoDaDataDeReferenciaCodigo, referencia.tipo ?? ''),
    data: referencia.data,
    faseId,
  };
}

function prazoParaEnvio(
  prazo: NonNullable<CriteriosDoComprovante['prazoDeEmissao']>,
  fases: ReadonlyMap<string, string>,
) {
  return {
    ...prazo,
    escolha: codigoDoContrato(EscolhaDoPrazoDeEmissaoCodigo, prazo.escolha),
    unidade: codigoDoContrato(UnidadeDoPrazoDeEmissaoCodigo, prazo.unidade ?? ''),
    efeitoForaDoPrazo: codigoDoContrato(
      EfeitoNaAnaliseDoDocumentoCodigo,
      prazo.efeitoForaDoPrazo ?? '',
    ),
    referencia: referenciaParaEnvio(prazo.referencia, fases),
  };
}

function validadeParaEnvio(
  validade: NonNullable<CriteriosDoComprovante['validade']>,
  fases: ReadonlyMap<string, string>,
) {
  return {
    ...validade,
    escolha: codigoDoContrato(EscolhaDaValidadeCodigo, validade.escolha),
    efeitoDoVencimento: codigoDoContrato(
      EfeitoNaAnaliseDoDocumentoCodigo,
      validade.efeitoDoVencimento ?? '',
    ),
    referencia: referenciaParaEnvio(validade.referencia, fases),
  };
}

export function prazoEValidadeParaEnvio(
  criterios: CriteriosDoComprovante,
  fases: ReadonlyMap<string, string>,
): Pick<RequisitosInput, 'prazoDeEmissao' | 'validade'> {
  const { prazoDeEmissao, validade } = criterios;
  return {
    prazoDeEmissao: prazoDeEmissao === null ? null : prazoParaEnvio(prazoDeEmissao, fases),
    validade: validade === null ? null : validadeParaEnvio(validade, fases),
  };
}
