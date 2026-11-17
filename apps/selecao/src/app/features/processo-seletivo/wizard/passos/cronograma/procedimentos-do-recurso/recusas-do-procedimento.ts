import type { RecusaDoCampo } from '@uniplus/shared-ui/components';

import { mesmoAlvo } from '../../../shared/procedimentos-do-recurso/unicidade-dos-procedimentos';
import type { IdentidadeDoProcedimento } from '../../../documento/edicoes/procedimentos-de-recurso.edicao';
import type { LinhaDoProcedimento } from './procedimentos-na-tela';

/**
 * Recusa de uma ocorrência do procedimento. Tipo nulo aponta a janela; `semLinha` mantém a
 * ausência junto ao tipo mesmo quando há um seletor vazio para declarar o procedimento.
 */
export interface RecusaDoProcedimento extends Omit<IdentidadeDoProcedimento, 'tipoDeDecisao'> {
  readonly tipoDeDecisao: IdentidadeDoProcedimento['tipoDeDecisao'] | null;
  readonly semLinha?: boolean;
  readonly recusa: RecusaDoCampo;
}

function mesmaOcorrencia(
  uma: Pick<IdentidadeDoProcedimento, 'alvo' | 'ocorrencia'>,
  outra: Pick<IdentidadeDoProcedimento, 'alvo' | 'ocorrencia'>,
): boolean {
  return (uma.ocorrencia ?? 0) === (outra.ocorrencia ?? 0) && mesmoAlvo(uma.alvo, outra.alvo);
}

/** As recusas da ocorrência indicada, sem agrupar duplicatas importadas. */
export function recusasDoProcedimento(
  recusas: readonly RecusaDoProcedimento[],
  identidade: IdentidadeDoProcedimento,
): readonly RecusaDoCampo[] {
  return recusas
    .filter(
      (recusa) =>
        !recusa.semLinha &&
        recusa.tipoDeDecisao === identidade.tipoDeDecisao &&
        mesmaOcorrencia(recusa, identidade),
    )
    .map((recusa) => recusa.recusa);
}

/**
 * As recusas do tipo de decisão que nenhuma linha mostrada recebe, como a de um alvo que o modo
 * vigente não oferece: ficam junto ao tipo para não sumirem.
 */
export function recusasSemLinha(
  recusas: readonly RecusaDoProcedimento[],
  tipoDeDecisao: string,
  linhas: readonly Pick<LinhaDoProcedimento, 'alvo' | 'ocorrencia'>[],
): readonly RecusaDoCampo[] {
  return recusas
    .filter(
      (recusa) =>
        recusa.tipoDeDecisao === tipoDeDecisao &&
        (recusa.semLinha || !linhas.some((linha) => mesmaOcorrencia(recusa, linha))),
    )
    .map((recusa) => recusa.recusa);
}
