import type { ExigenciasDoRascunho } from '../../processo-seletivo.models';

import { comAlcanceDeTodasAsFases } from './alcance-das-exigencias';
import { todasAsExigencias } from './consulta-das-exigencias';
import { aguardaFormulario } from './formulario-da-exigencia';
import type { ProcessoVivoDasExigencias } from './gravacao-das-exigencias';

/**
 * Se algum documento exigido de uma fase do cronograma gravado cai numa fase que o servidor ainda
 * não tem formulário: o servidor recusa o conjunto inteiro por causa de um só. O documento lido do
 * servidor (`faseIdLido`) já viaja com o formulário que ele gravou.
 */
export function algumDocumentoAguardaFormulario(
  exigencias: ExigenciasDoRascunho,
  { faseIdPorCodigo, formulariosPorFase }: ProcessoVivoDasExigencias,
): boolean {
  const completas = comAlcanceDeTodasAsFases(exigencias, [...faseIdPorCodigo.keys()]);
  return todasAsExigencias(completas).some(
    (documento) =>
      !documento.faseIdLido &&
      faseIdPorCodigo.has(documento.faseCodigo) &&
      aguardaFormulario(formulariosPorFase.get(documento.faseCodigo) ?? []),
  );
}
