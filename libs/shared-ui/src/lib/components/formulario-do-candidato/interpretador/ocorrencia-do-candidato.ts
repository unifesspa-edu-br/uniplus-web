/** O fato do parentesco, que identifica a ocorrência do próprio candidato no grupo que o inclui. */
export const FATO_PARENTESCO = 'PARENTESCO';
export const PROPRIO_CANDIDATO = 'PROPRIO_CANDIDATO';

/** A ocorrência é do próprio candidato quando o parentesco dela diz isso. */
export function ehParentescoDoCandidato(parentesco: unknown): boolean {
  return parentesco === PROPRIO_CANDIDATO;
}

type RespostasDaOcorrencia = Readonly<Record<string, unknown>> | null | undefined;

/**
 * A ocorrência do candidato, no grupo que o inclui: a primeira com o parentesco dele. Outra com o
 * mesmo parentesco é um integrante como os demais. Sem ela, ou no grupo que não inclui o candidato,
 * nula.
 */
export function indiceDaOcorrenciaDoCandidato(
  incluiCandidato: boolean,
  ocorrencias: readonly RespostasDaOcorrencia[],
): number | null {
  if (!incluiCandidato) return null;
  const indice = ocorrencias.findIndex((respostas) =>
    ehParentescoDoCandidato(respostas?.[FATO_PARENTESCO]),
  );
  return indice < 0 ? null : indice;
}

/**
 * O título de cada ocorrência de um grupo, na ordem da lista: a do candidato é "Você (candidato)"; as
 * demais são integrantes, numerados a partir de 1.
 */
export function titulosDasOcorrencias(
  incluiCandidato: boolean,
  ocorrencias: readonly RespostasDaOcorrencia[],
): string[] {
  const doCandidato = indiceDaOcorrenciaDoCandidato(incluiCandidato, ocorrencias);
  let integrante = 0;
  return ocorrencias.map((_, i) =>
    i === doCandidato ? 'Você (candidato)' : `Integrante ${++integrante}`,
  );
}
