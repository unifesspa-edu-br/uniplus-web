/** Os ids que descrevem um controle, para o `aria-describedby`: nulo quando nenhum se aplica. */
export function idsDescritivos(ids: readonly (string | null)[]): string | null {
  return ids.filter((id) => id !== null).join(' ') || null;
}
