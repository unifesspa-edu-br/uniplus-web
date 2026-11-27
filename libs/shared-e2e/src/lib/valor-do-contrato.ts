/** Campo de enum da API: o código estável e o rótulo pronto para mostrar. */
export interface ValorDoContrato<Codigo extends string> {
  readonly codigo: Codigo;
  readonly rotulo: string;
}
