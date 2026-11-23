import type {
  DataDeReferenciaDoDocumentoDto,
  DataDeReferenciaDoDocumentoInput,
  PrazoDeEmissaoDto,
  ValidadeDoDocumentoDto,
  RequisitosDoDocumentoDtoProvisorio,
  RequisitosDoDocumentoInputProvisorio,
} from '@uniplus/shared-data/selecao';
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
  requisitos: RequisitosDoDocumentoDtoProvisorio,
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
  return { tipo: referencia.tipo, data: referencia.data, faseId };
}

function prazoParaEnvio(
  prazo: NonNullable<CriteriosDoComprovante['prazoDeEmissao']>,
  fases: ReadonlyMap<string, string>,
) {
  return { ...prazo, referencia: referenciaParaEnvio(prazo.referencia, fases) };
}

function validadeParaEnvio(
  validade: NonNullable<CriteriosDoComprovante['validade']>,
  fases: ReadonlyMap<string, string>,
) {
  return { ...validade, referencia: referenciaParaEnvio(validade.referencia, fases) };
}

export function prazoEValidadeParaEnvio(
  criterios: CriteriosDoComprovante,
  fases: ReadonlyMap<string, string>,
): RequisitosDoDocumentoInputProvisorio {
  const { prazoDeEmissao, validade } = criterios;
  return {
    ...(prazoDeEmissao === null ? {} : { prazoDeEmissao: prazoParaEnvio(prazoDeEmissao, fases) }),
    ...(validade === null ? {} : { validade: validadeParaEnvio(validade, fases) }),
  };
}
