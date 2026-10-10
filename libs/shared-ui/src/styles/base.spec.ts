import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** O primeiro `@media print` (com os blocos aninhados) e o resto da folha, sem ele. */
function separarImpressao(css: string): { readonly impressao: string; readonly tela: string } {
  const inicio = css.search(/@media\s+print\s*\{/u);
  if (inicio < 0) return { impressao: '', tela: css };
  const abertura = css.indexOf('{', inicio);
  let profundidade = 0;
  for (let i = abertura; i < css.length; i++) {
    if (css[i] === '{') profundidade++;
    else if (css[i] === '}' && --profundidade === 0) {
      return {
        impressao: css.slice(abertura + 1, i),
        tela: css.slice(0, inicio) + css.slice(i + 1),
      };
    }
  }
  return { impressao: '', tela: css };
}

describe('base.css — impressão', () => {
  // Comentários removidos: a asserção tem de casar CSS aplicado, nunca uma declaração comentada.
  const css = readFileSync(resolve(__dirname, 'base.css'), 'utf-8').replace(
    /\/\*[\s\S]*?\*\//gu,
    '',
  );

  it('.u-no-print some do papel, e só do papel', () => {
    const { impressao, tela } = separarImpressao(css);

    expect(impressao.match(/\.u-no-print\s*\{([^{}]*)\}/u)?.[1]).toContain(
      'display: none !important',
    );
    expect(tela).not.toContain('.u-no-print');
  });
});
