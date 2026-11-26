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

/** Exige um código conhecido sem incluir o valor informado na mensagem de erro. */
export function codigoExigidoDoContrato<E extends Record<string, string>>(
  contrato: E,
  valor: string,
  oQue: string,
): E[keyof E] {
  const codigo = codigoDoContrato(contrato, valor);
  if (codigo === null) throw new Error(`O valor informado para ${oQue} é inválido.`);
  return codigo;
}
