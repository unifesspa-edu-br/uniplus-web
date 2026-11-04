/**
 * Se a citação da norma é um endereço que o navegador sabe abrir.
 *
 * O campo é texto livre de citação normativa e pode ser um DOI (`10.1590/abc`) ou uma URN
 * (`urn:lex:br:federal:lei:2012-08-29;12711`). Um DOI nu como `href` abriria uma rota da própria
 * aplicação, e a URN é barrada pelo sanitizador: nos dois casos a citação só pode ser mostrada
 * como texto.
 */
export function ehEnderecoNavegavel(citacao: string | null | undefined): boolean {
  return citacao !== null && citacao !== undefined && /^https?:\/\//i.test(citacao.trim());
}
