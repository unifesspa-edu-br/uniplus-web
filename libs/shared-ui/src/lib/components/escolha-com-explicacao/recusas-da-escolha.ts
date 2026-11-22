import type { RecusaDoCampo } from '../recusa-do-campo/recusa-do-campo';

/** Uma recusa pronta para o desenho: o identificador do seu elemento e a recusa. */
export interface RecusaNaTela {
  readonly id: string;
  readonly lista: readonly RecusaDoCampo[];
}

/** O identificador livre mais próximo de `id`: o próprio ou, já em uso, `id` com o menor número ao fim. */
function idLivre(id: string, usados: Set<string>): string {
  let candidato = id;
  for (let vez = 2; usados.has(candidato); vez++) candidato = `${id}-${vez}`;
  usados.add(candidato);
  return candidato;
}

/**
 * Dá a cada recusa o identificador do seu elemento, formado por `base` e pelo código da recusa.
 * Identificador já usado por outra recusa ganha um número ao fim que também não repete nenhum
 * outro, para cada elemento poder ser citado sozinho por `aria-describedby`.
 */
export function recusasNaTela(recusas: readonly RecusaDoCampo[], base: string): RecusaNaTela[] {
  const usados = new Set<string>();
  return recusas.map((recusa) => ({
    id: idLivre(`${base}-${recusa.codigo}`, usados),
    lista: [recusa],
  }));
}

/**
 * Os identificadores que descrevem o campo: as recusas que ainda valem, as a conferir e, havendo
 * alguma a conferir, a nota que as explica.
 */
export function idsDasRecusasDoCampo(
  ativas: readonly RecusaNaTela[],
  aConferir: readonly RecusaNaTela[],
  idDaNota: string | null,
): string[] {
  const nota = aConferir.length > 0 && idDaNota !== null ? [idDaNota] : [];
  return [...ativas, ...aConferir].map((recusa) => recusa.id).concat(nota);
}
