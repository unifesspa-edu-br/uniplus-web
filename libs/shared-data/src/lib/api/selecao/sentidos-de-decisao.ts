/** O sentido de um motivo em relação ao candidato, com o nome que a tela mostra. */
export interface SentidoDeDecisao {
  readonly codigo: string;
  readonly rotulo: string;
}

/** O contrato admite exatamente estes dois sentidos; cadastro e escolha de motivos leem este vocabulário. */
export const SENTIDOS_DE_DECISAO: readonly SentidoDeDecisao[] = [
  { codigo: 'FAVORAVEL', rotulo: 'Favorável ao candidato' },
  { codigo: 'DESFAVORAVEL', rotulo: 'Desfavorável ao candidato' },
];

/** O nome do código, ou o próprio código quando o vocabulário não o conhece. */
export function rotuloDoSentido(codigo: string): string {
  return SENTIDOS_DE_DECISAO.find((sentido) => sentido.codigo === codigo)?.rotulo ?? codigo;
}
