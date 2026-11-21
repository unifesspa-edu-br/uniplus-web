import type { EtapaPontuada } from '../../processo-seletivo.models';
import type { LocalDaRecusa } from '../../shared/recusas/local-da-recusa';

/**
 * A parte do cadastro a que uma recusa pertence. Alterar a parte passa todas as recusas dela a
 * "a conferir de novo": a etapa é tudo o que não é recurso, inclusive bancas, itens e publicações;
 * cada recurso é conferido à parte, pela posição dele.
 */
export type ParteDaEtapa = 'etapa' | { readonly recurso: number };

/** A parte em que o lugar da recusa cai: o recurso que ele nomeia, ou a etapa. */
export function parteDaEtapa(local: LocalDaRecusa): ParteDaEtapa {
  return local.recurso === null ? 'etapa' : { recurso: local.recurso };
}

const FORA_DA_PARTE_DA_ETAPA: ReadonlySet<string> = new Set(['recursos', 'ordem']);

/**
 * O que a etapa tem naquela parte. A posição não conta: renumerar as etapas porque outra saiu não
 * altera o que a recusa apontou. Recurso que não existe mais vale `null`.
 */
export function conteudoDaParteDaEtapa(etapa: EtapaPontuada, parte: ParteDaEtapa): unknown {
  if (parte !== 'etapa') return etapa.recursos[parte.recurso] ?? null;
  return Object.fromEntries(
    Object.entries(etapa).filter(([campo]) => !FORA_DA_PARTE_DA_ETAPA.has(campo)),
  );
}
