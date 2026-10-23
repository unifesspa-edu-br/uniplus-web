import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** A folha sem comentários: a asserção tem de casar CSS aplicado, nunca uma declaração comentada. */
function folha(nome: string): string {
  return readFileSync(resolve(__dirname, nome), 'utf-8').replace(/\/\*[\s\S]*?\*\//gu, '');
}

/** O texto como literal de expressão regular: todo metacaractere escapado. */
function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/** O tamanho de fonte da regra, em rem, resolvendo o token do DS quando a regra o cita. */
function tamanhoEmRem(seletor: string): number {
  const regra = folha('components.css').match(
    new RegExp(`${escaparRegex(seletor)}\\s*\\{([^{}]*)\\}`, 'u'),
  )?.[1];
  const valor = regra?.match(/font-size:\s*([^;]+);/u)?.[1].trim() ?? '';
  const token = valor.match(/^var\((--[\w-]+)\)$/u)?.[1];
  const resolvido = token
    ? (folha('tokens.css')
        .match(new RegExp(`${token}:\\s*([^;]+);`, 'u'))?.[1]
        .trim() ?? '')
    : valor;
  return Number.parseFloat(resolvido.replace(/rem$/u, ''));
}

describe('components.css — tamanho mínimo de fonte do contrato AAA', () => {
  it('o título dos filtros, texto do botão que recolhe o bloco, tem ao menos 14px', () => {
    expect(tamanhoEmRem('.filter-bar__titulo')).toBeGreaterThanOrEqual(0.875);
  });
});

/** A primeira declaração do token em `tokens.css`, a do tema base: `light-dark()` vira [claro, escuro]. */
function valoresDoToken(token: string): readonly [string, string] {
  const valor =
    folha('tokens.css')
      .match(new RegExp(`${escaparRegex(token)}:\\s*([^;]+);`, 'u'))?.[1]
      .trim() ?? '';
  const par = valor.match(/^light-dark\(\s*([^,]+?)\s*,\s*([^)]+?)\s*\)$/u);
  return par ? [par[1], par[2]] : [valor, valor];
}

/** O valor que a regra dá à propriedade, numa regra cujo seletor começa a linha sozinho. */
function propriedadeDaRegra(seletor: string, propriedade: string): string {
  const regra = folha('components.css').match(
    new RegExp(`(?<!,\\s*)^${escaparRegex(seletor)}\\s*\\{([^{}]*)\\}`, 'mu'),
  )?.[1];
  return (
    regra?.match(new RegExp(`${escaparRegex(propriedade)}:\\s*([^;]+);`, 'u'))?.[1].trim() ?? ''
  );
}

/** Razão de contraste entre duas cores `#rrggbb`, pela luminância relativa da WCAG. */
function contraste(a: string, b: string): number {
  const luminancia = (hex: string): number => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}

describe('components.css — passo com erro do ui-steps na sobreposição', () => {
  /**
   * A sobreposição fica sobre `--surface-inverse`, escura também no tema claro. A borda do número e o
   * sublinhado do passo com recusa são componente não textual: pedem 3:1 sobre ela (WCAG 1.4.11).
   */
  it('a cor de erro tem ao menos 3:1 sobre a superfície invertida, nos temas claro e escuro', () => {
    const token = propriedadeDaRegra('.ui-steps--sobreposicao', '--ui-steps-erro').match(
      /^var\((--[\w-]+)\)$/u,
    )?.[1];
    expect(token).toBeDefined();
    const [erroClaro, erroEscuro] = valoresDoToken(token ?? '');
    const [fundoClaro, fundoEscuro] = valoresDoToken('--surface-inverse');

    expect(contraste(erroClaro, fundoClaro)).toBeGreaterThanOrEqual(3);
    expect(contraste(erroEscuro, fundoEscuro)).toBeGreaterThanOrEqual(3);
  });
});
