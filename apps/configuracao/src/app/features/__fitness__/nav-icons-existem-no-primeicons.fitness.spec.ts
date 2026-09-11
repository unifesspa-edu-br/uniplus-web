import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const LAYOUT_PATH = path.resolve(__dirname, '../../layout/layout.ts');
const PRIMEICONS_CSS_PATH = require.resolve('primeicons/primeicons.css');

function iconesDeclaradosNoMenu(): readonly string[] {
  const source = fs.readFileSync(LAYOUT_PATH, 'utf-8');
  const matches = source.matchAll(/icon:\s*'([a-z0-9-]+)'/g);
  return [...new Set([...matches].map((m) => m[1]))];
}

function iconesValidosDoPrimeicons(): ReadonlySet<string> {
  const css = fs.readFileSync(PRIMEICONS_CSS_PATH, 'utf-8');
  const matches = css.matchAll(/^\.(pi-[a-z0-9-]+):before\s*\{/gm);
  return new Set([...matches].map((m) => m[1]));
}

/**
 * `<i [class]="'pi ' + item.icon">` (app-shell) renderiza silenciosamente vazio
 * quando `item.icon` não bate com nenhum glifo do PrimeIcons — não há erro de
 * build, lint nem teste que pegue isso: o HTML/CSS resultante é sintaticamente
 * válido, só não desenha nada. Aconteceu com `pi-gavel` (não existe no
 * catálogo) no item de menu de Base Legal de Bônus Regional.
 */
describe('Fitness — ícones do menu lateral existem no PrimeIcons', () => {
  it('todo icon: declarado em layout.ts tem glifo correspondente', () => {
    const declarados = iconesDeclaradosNoMenu();
    const validos = iconesValidosDoPrimeicons();
    const invalidos = declarados.filter((icone) => !validos.has(icone));

    expect(
      invalidos,
      invalidos.length > 0
        ? `\nÍcone(s) sem glifo no PrimeIcons — renderizam vazios: ${invalidos.join(', ')}`
        : '',
    ).toEqual([]);
  });
});
