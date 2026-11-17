import {
  daMesmaFaseOuEtapa,
  ehOMesmoMotivo,
  type FaseOuEtapaDoMotivo,
  type IdentidadeDoMotivo,
  type MotivoNoDocumento,
} from './motivo-no-documento';

/** O motivo que a escolha repetiria: já está escolhido na mesma fase ou etapa. */
export interface RecusaDaEscolha {
  readonly motivoRepetido: IdentidadeDoMotivo;
}

export type ResultadoDaEscolha =
  | { readonly escolhido: true; readonly motivos: readonly MotivoNoDocumento[] }
  | { readonly escolhido: false; readonly recusa: RecusaDaEscolha };

/** Os motivos escolhidos pela fase ou etapa, na ordem do documento. */
export function motivosDaFaseOuEtapa(
  motivos: readonly MotivoNoDocumento[],
  faseOuEtapa: FaseOuEtapaDoMotivo,
): readonly MotivoNoDocumento[] {
  return motivos.filter((motivo) => daMesmaFaseOuEtapa(motivo, faseOuEtapa));
}

/**
 * Acrescenta o motivo ao fim da lista. Repetir o mesmo motivo na mesma fase ou etapa é recusado;
 * o mesmo motivo em outra fase ou etapa é outra escolha. O tipo do motivo nunca recusa.
 */
export function escolher(
  motivos: readonly MotivoNoDocumento[],
  novo: MotivoNoDocumento,
): ResultadoDaEscolha {
  const jaEscolhido = motivos.some((motivo) => ehOMesmoMotivo(motivo, novo));
  return jaEscolhido
    ? { escolhido: false, recusa: { motivoRepetido: novo } }
    : { escolhido: true, motivos: [...motivos, novo] };
}

/** A lista sem o motivo da fase ou etapa; retirar o que não está escolhido não muda nada. */
export function retirar(
  motivos: readonly MotivoNoDocumento[],
  identidade: IdentidadeDoMotivo,
): readonly MotivoNoDocumento[] {
  return motivos.filter((motivo) => !ehOMesmoMotivo(motivo, identidade));
}

/** A lista sem os motivos da fase ou etapa que saiu do documento. */
export function semMotivosDeFaseOuEtapaRemovida(
  motivos: readonly MotivoNoDocumento[],
  removida: FaseOuEtapaDoMotivo,
): readonly MotivoNoDocumento[] {
  return motivos.filter((motivo) => !daMesmaFaseOuEtapa(motivo, removida));
}
