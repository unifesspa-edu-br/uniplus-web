import type { ItemDasRegras, RegrasDoFormulario } from './interpretador/regras-do-formulario';

/** A regra de cada campo e subitem, pelo fato. */
export function regrasPorFato(regras: RegrasDoFormulario): ReadonlyMap<string, ItemDasRegras> {
  return new Map(
    (regras.etapas ?? [])
      .flatMap((e) => [...(e.itens ?? []), ...(e.grupos ?? []).flatMap((g) => g.subitens ?? [])])
      .map((item) => [item.fatoCodigo, item]),
  );
}

/** O fato da UF de que o campo de município depende, pela restrição dos municípios da UF. */
export function fatoDaUf(regra: ItemDasRegras | null): string | null {
  return regra?.restricoes?.find((r) => r.tipo === 'MUNICIPIOS_DA_UF')?.fatos?.[0] ?? null;
}
