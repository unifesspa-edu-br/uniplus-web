/** Uma parte do documento que tem chave local. */
interface ComChave {
  readonly chave: string;
  readonly origem?: number;
}

/** Aplica as alterações na ordem dada, cada uma sobre o resultado da anterior. */
export function comAlteracoes<T>(parte: T, ...alteracoes: readonly ((atual: T) => T)[]): T {
  return alteracoes.reduce((atual, alterar) => alterar(atual), parte);
}

/**
 * As partes do formulário, na ordem em que ele as traz, cada uma sobre a parte do documento que
 * veio da origem lida, pois a chave pode estar repetida no documento. A parte que o formulário deixou de
 * trazer sai; a que o documento não tem não entra, porque parte nova só nasce pelo `acrescentar`,
 * que atribui a chave.
 */
export function partesAlteradas<P extends ComChave, V extends ComChave>(
  atuais: readonly P[],
  valores: readonly V[],
  alterar: (atual: P, valores: V) => P,
): P[] {
  return partesPareadas(atuais, valores).map(([atual, doFormulario]) =>
    alterar(atual, doFormulario),
  );
}

/** Cada valor do formulário com a parte do documento que ocupa o lugar dele, na ordem do formulário. */
export function partesPareadas<P extends ComChave, V extends ComChave>(
  atuais: readonly P[],
  valores: readonly V[],
): (readonly [P, V])[] {
  return partesPorOrigem(atuais, valores);
}

function partesPorOrigem<P extends ComChave, V extends ComChave>(
  atuais: readonly P[],
  valores: readonly V[],
): (readonly [P, V])[] {
  const usadas = new Set<number>();
  return valores.flatMap((valor) => {
    const origem = valor.origem;
    if (origem === undefined || usadas.has(origem)) return [];
    const atual = atuais[origem];
    if (atual?.chave !== valor.chave) return [];
    usadas.add(origem);
    return [[atual, valor] as const];
  });
}

/** Se alguma parte passou a vir antes de outra que antes a precedia. */
export function mudouDeOrdem<P>(
  atuais: readonly P[],
  pares: readonly (readonly [P, unknown])[],
): boolean {
  const posicoes = pares.map(([parte]) => atuais.indexOf(parte));
  return posicoes.some((posicao, indice) => indice > 0 && posicao < posicoes[indice - 1]);
}

/** A lista com a primeira parte da chave alterada; sem parte com a chave, `undefined`. */
export function comPartePorChave<P extends ComChave>(
  partes: readonly P[],
  chave: string,
  alterar: (parte: P) => P,
): P[] | undefined {
  const posicao = partes.findIndex((parte) => parte.chave === chave);
  if (posicao < 0) return undefined;
  return partes.map((parte, indice) => (indice === posicao ? alterar(parte) : parte));
}
