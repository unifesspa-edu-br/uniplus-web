import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** A folha sem comentários: a asserção tem de casar CSS aplicado, nunca uma declaração comentada. */
function folha(nome: string): string {
  return readFileSync(resolve(__dirname, nome), 'utf-8').replace(/\/\*[\s\S]*?\*\//gu, '');
}

/** O tamanho de fonte da regra, em rem, resolvendo o token do DS quando a regra o cita. */
function tamanhoEmRem(seletor: string): number {
  const regra = folha('components.css').match(
    new RegExp(`${seletor.replace(/[.]/gu, '\\.')}\\s*\\{([^{}]*)\\}`, 'u'),
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
