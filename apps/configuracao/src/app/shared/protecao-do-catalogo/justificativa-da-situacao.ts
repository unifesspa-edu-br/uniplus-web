import { DecidirProtecaoDoCatalogoRequestDecisao } from '@uniplus/shared-data/configuracao';
import type { AprovacaoDaProtecaoDto, AtoDaProtecaoDto } from '@uniplus/shared-data/configuracao';

/**
 * A justificativa que acompanha a situação do item. A do ajuste e a da devolução vêm na própria
 * aprovação; a da aprovação, não: ela fica no ato de aprovação mais recente do ciclo atual.
 */
export function justificativaDaSituacao(
  aprovacao: AprovacaoDaProtecaoDto,
  atos: readonly AtoDaProtecaoDto[],
): string | null {
  if (aprovacao.situacao !== 'APROVADA') return aprovacao.justificativa;
  const doCiclo = atos.filter(
    (ato) =>
      ato.ato === DecidirProtecaoDoCatalogoRequestDecisao.APROVACAO &&
      ato.ciclo === aprovacao.ciclo,
  );
  return doCiclo.at(-1)?.justificativa ?? null;
}
