import {
  daMesmaFaseOuEtapa,
  ehOMesmoMotivo,
  type IdentidadeDoMotivo,
  type LugarDoMotivo,
  type MotivoReconhecivel,
} from './motivo-no-documento';

/** O motivo que a escolha repetiria: já está escolhido na mesma fase ou etapa. */
export interface RecusaDaEscolha<M extends MotivoReconhecivel = IdentidadeDoMotivo> {
  readonly motivoRepetido: M;
}

export type ResultadoDaEscolha<M extends MotivoReconhecivel = IdentidadeDoMotivo> =
  | { readonly escolhido: true; readonly motivos: readonly M[] }
  | { readonly escolhido: false; readonly recusa: RecusaDaEscolha<M> };

/** Os motivos escolhidos pela fase ou etapa, na ordem do documento. */
export function motivosDaFaseOuEtapa<M extends LugarDoMotivo>(
  motivos: readonly M[],
  faseOuEtapa: LugarDoMotivo,
): readonly M[] {
  return motivos.filter((motivo) => daMesmaFaseOuEtapa(motivo, faseOuEtapa));
}

/**
 * Acrescenta o motivo ao fim da lista. Repetir o mesmo motivo na mesma fase ou etapa é recusado;
 * o mesmo motivo em outra fase ou etapa é outra escolha. O tipo do motivo nunca recusa.
 */
export function escolher<M extends MotivoReconhecivel>(
  motivos: readonly M[],
  novo: M,
): ResultadoDaEscolha<M> {
  const jaEscolhido = motivos.some((motivo) => ehOMesmoMotivo(motivo, novo));
  return jaEscolhido
    ? { escolhido: false, recusa: { motivoRepetido: novo } }
    : { escolhido: true, motivos: [...motivos, novo] };
}

/** A lista sem o motivo da fase ou etapa; retirar o que não está escolhido não muda nada. */
export function retirar<M extends MotivoReconhecivel>(
  motivos: readonly M[],
  identidade: MotivoReconhecivel,
): readonly M[] {
  const posicao = motivos.findIndex((motivo) => ehOMesmoMotivo(motivo, identidade));
  return motivos.filter((_motivo, indice) => indice !== posicao);
}

/** A lista sem os motivos da fase ou etapa que saiu do documento. */
export function semMotivosDeFaseOuEtapaRemovida<M extends LugarDoMotivo>(
  motivos: readonly M[],
  removida: LugarDoMotivo,
): readonly M[] {
  return motivos.filter((motivo) => !daMesmaFaseOuEtapa(motivo, removida));
}
