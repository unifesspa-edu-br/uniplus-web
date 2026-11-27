import type { ExigenciasDoRascunho } from '../../processo-seletivo.models';

import { comAlcanceDeTodasAsFases } from './alcance-das-exigencias';
import { todasAsExigencias } from './consulta-das-exigencias';
import { codigoEnviado } from './formulario-da-exigencia';
import type { ProcessoVivoDasExigencias } from './gravacao-das-exigencias';

/**
 * Se algum documento exigido de uma fase do cronograma gravado ainda não tem o formulário que o
 * servidor exige: a fase não tem formulário, ou tem mais de um e o documento não escolheu. O
 * servidor recusa o conjunto inteiro por causa de um só, e o envio nunca leva código vazio. O
 * documento lido do servidor (`faseIdLido`) já viaja com o formulário que ele gravou.
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
      codigoEnviado(
        documento.formularioCodigo,
        formulariosPorFase.get(documento.faseCodigo) ?? [],
      ) === null,
  );
}
