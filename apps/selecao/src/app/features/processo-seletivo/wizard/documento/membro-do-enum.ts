function ehMembro<E extends Record<string, string>>(
  membros: E,
  valor: string,
): valor is E[keyof E] {
  return Object.values(membros).includes(valor);
}

/** O membro do enum que tem o valor, ou `undefined` quando o valor não é um membro dele. */
export function membroDoEnum<E extends Record<string, string>>(
  membros: E,
  valor: string,
): E[keyof E] | undefined {
  return ehMembro(membros, valor) ? valor : undefined;
}
