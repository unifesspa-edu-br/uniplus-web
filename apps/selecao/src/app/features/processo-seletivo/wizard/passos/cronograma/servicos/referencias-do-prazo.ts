import type { ExigenciaDeDocumento, ExigenciasDoRascunho } from '../../../processo-seletivo.models';
import { comAlcanceDeTodasAsFases } from '../../../shared/exigencias/alcance-das-exigencias';
import { todasAsExigencias } from '../../../shared/exigencias/consulta-das-exigencias';

export interface DependentesDaFase {
  readonly etapas: number;
  readonly documentos: number;
  readonly referencias: readonly ExigenciaDeDocumento[];
}

export function documentosQueReferenciamAFase(
  exigencias: ExigenciasDoRascunho,
  fases: readonly string[],
  codigo: string,
): readonly ExigenciaDeDocumento[] {
  const declaradas = comAlcanceDeTodasAsFases(exigencias, fases);
  return todasAsExigencias(declaradas).filter(
    (documento) =>
      documento.faseCodigo !== codigo &&
      (documento.prazoDeEmissao?.referencia?.faseCodigo === codigo ||
        documento.validade?.referencia?.faseCodigo === codigo),
  );
}
