import type { ExigenciasDoRascunho } from '../../../processo-seletivo.models';
import {
  exigenciasLocalizadasDaFase,
  type ExigenciaLocalizada,
} from '../../../shared/exigencias/consulta-das-exigencias';
import { semAExigencia } from '../../../shared/exigencias/exigencias-documentais';
import { modeloParaTodasAsFases } from './documentos-declarados';

export function declaracaoHerdada(
  exigencias: ExigenciasDoRascunho,
  declaradas: readonly ExigenciaLocalizada[],
  tipo: string,
  faseCodigo: string,
): readonly ExigenciaLocalizada[] {
  if (declaradas.some((item) => item.documento.tipoDocumentoId === tipo && item.grupo === null))
    return [];
  const modelo = modeloParaTodasAsFases(exigencias, tipo);
  if (modelo === undefined) return [];
  const documento = { ...modelo, faseCodigo, etapaId: null, finalidade: null };
  return [{ identificadorNoRascunho: tipo, documento, grupo: null, repeticao: null }];
}

export function semDeclaracaoDaFase(
  exigencias: ExigenciasDoRascunho,
  faseCodigo: string,
  tipo: string,
  declaracao: ExigenciaLocalizada | undefined,
): ExigenciasDoRascunho {
  const localizadas = exigenciasLocalizadasDaFase(exigencias, faseCodigo);
  const identificador = identificadorDaDeclaracao(localizadas, tipo, declaracao);
  const emTodasAsFases = tiposComAlcance(exigencias, tipo, declaracao);
  return {
    ...semAExigencia(exigencias, identificador),
    emTodasAsFases,
  };
}

function tiposComAlcance(
  exigencias: ExigenciasDoRascunho,
  tipo: string,
  declaracao: ExigenciaLocalizada | undefined,
): readonly string[] {
  return declaracao?.grupo == null
    ? exigencias.emTodasAsFases.filter((item) => item !== tipo)
    : exigencias.emTodasAsFases;
}

function identificadorDaDeclaracao(
  localizadas: readonly ExigenciaLocalizada[],
  tipo: string,
  declaracao: ExigenciaLocalizada | undefined,
): string {
  return (
    localizadas.find((item) => item.identificadorNoRascunho === declaracao?.identificadorNoRascunho)
      ?.identificadorNoRascunho ??
    localizadas.find((item) => item.documento.tipoDocumentoId === tipo && item.grupo === null)
      ?.identificadorNoRascunho ??
    ''
  );
}
