/** O código a partir do nome: sem acento, em caixa alta, com sublinhado no lugar do resto. */
export function codigoDoNome(nome: string, reserva: string): string {
  const codigo = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .slice(0, 50);
  return codigo === '' ? reserva : codigo;
}

export function codigoLivre(base: string, usados: ReadonlySet<string>): string {
  let codigo = base;
  for (let numero = 2; usados.has(codigo); numero++) codigo = `${base}_${numero}`;
  return codigo;
}

export function nomeDoFato(nomes: ReadonlyMap<string, string>, fato: string): string {
  return nomes.get(fato) ?? fato;
}
