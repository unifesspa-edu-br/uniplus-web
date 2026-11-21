/**
 * O membro do enum do contrato da API que tem o código dado, ou `null` quando o contrato não
 * conhece esse código. Serve à fronteira em que a tela entrega texto e o comando ou a resposta
 * tipada exige o enum gerado.
 */
export function codigoDoContrato<E extends Record<string, string>>(
  contrato: E,
  codigo: string,
): E[keyof E] | null {
  return Object.values(contrato).find((membro): membro is E[keyof E] => membro === codigo) ?? null;
}
