/** O rótulo de cada estado que a avaliação devolve — um só para todas as tabelas da pré-visualização. */
const ESTADOS: Readonly<Record<string, string>> = {
  VERDADEIRO: 'Sim',
  FALSO: 'Não',
  INDETERMINADO: 'Depende de resposta ainda não dada',
};

/** O estado (`VERDADEIRO`, `FALSO` ou `INDETERMINADO`) como se lê na tela; o desconhecido aparece como veio. */
export function rotuloDoEstado(token: string): string {
  return ESTADOS[token] ?? token;
}

/** A situação do documento (`EXIGIDO`, `NAO_EXIGIDO` ou `INDETERMINADO`); o indeterminado se lê como o dos campos. */
export function rotuloDaSituacao(situacao: string): string {
  if (situacao === 'EXIGIDO') return 'Exigido';
  if (situacao === 'NAO_EXIGIDO') return 'Não exigido';
  return rotuloDoEstado(situacao);
}
