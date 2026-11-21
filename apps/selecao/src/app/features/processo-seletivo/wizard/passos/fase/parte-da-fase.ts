import type { FaseDoCronograma } from '../../processo-seletivo.models';
import type { LocalDaRecusa } from '../../shared/recusas/local-da-recusa';

/**
 * A parte do cadastro a que uma recusa pertence. Alterar a parte passa todas as recusas dela a
 * "a conferir de novo": a fase é tudo o que não é a regra de recurso, inclusive publicações e
 * datas; a regra de recurso é conferida à parte.
 */
export type ParteDaFase = 'fase' | 'regraDeRecurso';

/** A parte em que o caminho da recusa cai; o que não se reconhece pertence à fase. */
export function parteDaFase(local: LocalDaRecusa): ParteDaFase {
  const primeiro = (local.caminho ?? '').split('.')[0].toLowerCase();
  return primeiro === 'regrarecurso' ? 'regraDeRecurso' : 'fase';
}

const FORA_DA_PARTE_DA_FASE: ReadonlySet<string> = new Set(['regraRecurso', 'ordem']);

/**
 * O que a fase tem naquela parte. A posição não conta: renumerar as fases porque outra saiu não
 * altera o que a recusa apontou.
 */
export function conteudoDaParte(fase: FaseDoCronograma, parte: ParteDaFase): unknown {
  if (parte === 'regraDeRecurso') return fase.regraRecurso;
  return Object.fromEntries(
    Object.entries(fase).filter(([campo]) => !FORA_DA_PARTE_DA_FASE.has(campo)),
  );
}
