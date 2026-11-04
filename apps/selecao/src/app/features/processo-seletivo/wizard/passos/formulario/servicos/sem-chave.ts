/** O mapa sem a entrada da `chave`. */
export function semChave<V>(mapa: ReadonlyMap<string, V>, chave: string): ReadonlyMap<string, V> {
  return new Map([...mapa].filter(([atual]) => atual !== chave));
}
