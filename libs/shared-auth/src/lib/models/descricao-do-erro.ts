/**
 * A primeira descrição em texto que o erro carrega, na ordem dos campos dados. O erro que o
 * provedor OIDC devolve não tem forma fixa: a descrição aparece em campos diferentes.
 */
export function primeiraDescricao(erro: object, campos: readonly string[]): string {
  const valores = erro as Record<string, unknown>;
  const achada = campos
    .map((campo) => valores[campo])
    .find((valor): valor is string => typeof valor === 'string' && valor.length > 0);
  return achada ?? '';
}
