/**
 * O município de uma resposta da inscrição enviada: o código IBGE e o nome que o Geo conferiu no
 * envio. No rascunho, a resposta de município é só o código, como texto.
 */
export interface MunicipioGravado {
  readonly codigo: string;
  readonly rotulo: string;
}
