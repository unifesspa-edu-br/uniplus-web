/** Tetos espelhando `PesoAreaEnem.PesoMaximo`/`CorteMaximo` no backend: evitam o 422 por
 *  overflow das colunas `numeric(4,2)`/`numeric(7,3)`. */
export const PESO_MAXIMO = 99.99;
export const CORTE_MAXIMO = 1000;
/** Casas decimais que as colunas guardam: peso `numeric(4,2)`, corte `numeric(7,3)`. */
export const CASAS_PESO = 2;
export const CASAS_CORTE = 3;
/** Campo editável de uma área: o peso (obrigatório) e o corte (opcional). */
export type CampoDaArea = 'peso' | 'corte';
