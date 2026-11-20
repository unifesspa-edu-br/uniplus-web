/** Um valor de enum como a API o devolve: o código identifica o valor e o rótulo é o texto que a pessoa lê. */
export interface CodigoComRotulo<C extends string> {
  readonly codigo: C;
  readonly rotulo: string;
}
