import type {
  CondicaoGatilhoConfig,
  ExigenciaDeDocumento,
  RegraDeComprovacao,
} from '../../processo-seletivo.models';

import { documentosDe } from './consulta-das-exigencias';
import { APLICABILIDADE_GERAL } from './exigencias-documentais';
import { codigoEnviado } from './formulario-da-exigencia';
import { comRestricaoDeModalidades, modalidadesParaGravacao } from './modalidades-da-exigencia';

/** Os dados do processo usados para preparar as exigências para envio. */
export interface ProcessoVivoDasExigencias {
  readonly faseIdPorCodigo: ReadonlyMap<string, string>;
  readonly modalidadesOfertadas: readonly string[];
  /** O identificador de cada etapa do processo gravado, pela chave dela. */
  readonly etapaIdPorChave: ReadonlyMap<string, string>;
  /** Os códigos dos formulários que cada fase responde, pelo código da fase. */
  readonly formulariosPorFase: ReadonlyMap<string, readonly string[]>;
}

/**
 * O formulário da regra principal, declarado na primeira exigência de uma fase ativa e herdado por
 * todas as outras: o servidor recusa grupo com documentos de formulários diferentes.
 */
export function formularioHerdadoDaRegra(
  regraPrincipal: RegraDeComprovacao,
  { faseIdPorCodigo, formulariosPorFase }: ProcessoVivoDasExigencias,
): string | null {
  const declarante = documentosDe([regraPrincipal]).find((documento) =>
    faseIdPorCodigo.has(documento.faseCodigo),
  );
  return declarante === undefined
    ? null
    : codigoEnviado(
        declarante.formularioCodigo,
        formulariosPorFase.get(declarante.faseCodigo) ?? [],
      );
}

/** O formulário que o documento leva: o que ele já gravou, se foi lido do servidor, ou o herdado. */
export function formularioDoDocumento(
  documento: ExigenciaDeDocumento,
  herdado: string | null,
): string {
  return (documento.faseIdLido ? documento.formularioCodigo : herdado) ?? '';
}

/**
 * O identificador da etapa que coleta o documento. A etapa que saiu do cronograma não tem mais
 * identificador: o documento volta a ser da fase inteira em vez de referenciar uma etapa que o
 * processo não tem.
 */
export function etapaDeColetaValida(
  documento: ExigenciaDeDocumento,
  etapaIdPorChave: ReadonlyMap<string, string>,
): string | null {
  const etapaChave = documento.etapaChave;
  return etapaChave === null ? null : (etapaIdPorChave.get(etapaChave) ?? null);
}

/**
 * As condições que a exigência leva: nenhuma quando é geral (ADR-0071); senão as dela, com a
 * restrição às modalidades, se existir, no gatilho inteiro.
 */
export function condicoesDaExigencia(
  documento: ExigenciaDeDocumento,
  modalidadesOfertadas: readonly string[],
): readonly CondicaoGatilhoConfig[] {
  if (documento.aplicabilidade === APLICABILIDADE_GERAL) return [];
  const modalidadesRestritas = modalidadesParaGravacao(documento, modalidadesOfertadas);
  return comRestricaoDeModalidades(documento.condicoes, modalidadesRestritas);
}
