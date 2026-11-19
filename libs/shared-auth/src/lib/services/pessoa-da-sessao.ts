/**
 * A pessoa da sessão. A sessão do `AuthService` é `{pessoa}:{renovações}`: muda a cada renovação do
 * token, mas a pessoa só muda no login ou na troca de usuário. `null` é a ausência de sessão.
 */
export function pessoaDaSessao(sessao: string | null): string | null {
  return sessao === null ? null : sessao.slice(0, sessao.lastIndexOf(':'));
}
