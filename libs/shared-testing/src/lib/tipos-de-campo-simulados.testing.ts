/**
 * O vocabulário simulado dos tipos de campo, como a API o publica: código e rótulo, na ordem dela.
 * Os testes comparam o que a tela mostra com o rótulo deste dado, nunca com texto escrito no teste.
 */
export const TIPOS_DE_CAMPO_SIMULADOS: readonly {
  readonly codigo: string;
  readonly rotulo: string;
}[] = [
  'NUMERO',
  'SIM_OU_NAO',
  'ESCOLHA_UNICA',
  'ESCOLHA_MULTIPLA',
  'TEXTO',
  'DATA',
  'ENDERECO',
  'MUNICIPIO',
].map((codigo) => ({ codigo, rotulo: `Rótulo simulado: ${codigo}` }));

/** O rótulo que o vocabulário simulado traz para o código. */
export function rotuloSimuladoDoTipoDeCampo(codigo: string): string {
  const tipo = TIPOS_DE_CAMPO_SIMULADOS.find((candidato) => candidato.codigo === codigo);
  if (tipo === undefined) throw new Error(`Tipo de campo fora do vocabulário simulado: ${codigo}`);
  return tipo.rotulo;
}
