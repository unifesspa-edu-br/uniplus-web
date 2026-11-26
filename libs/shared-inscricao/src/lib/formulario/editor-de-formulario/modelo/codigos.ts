export function nomeDoFato(nomes: ReadonlyMap<string, string>, fato: string): string {
  return nomes.get(fato) ?? fato;
}
