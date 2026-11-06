import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const IMPORTACAO_LOCAL = /^@import\s+(?:url\()?["'](\.\/[^"']+)["']\)?\s*;[ \t]*$/gmu;

/**
 * O texto da folha com cada `@import` local substituído, na própria posição, pelo conteúdo do
 * arquivo importado. Devolve o que o build entrega, para o spec conferir regra e ordem sem
 * depender de como a folha foi dividida em arquivos.
 */
export function lerFolha(caminho: string): string {
  const texto = readFileSync(caminho, 'utf-8');
  return texto.replace(IMPORTACAO_LOCAL, (_importacao: string, relativo: string) =>
    lerFolha(resolve(dirname(caminho), relativo)),
  );
}
