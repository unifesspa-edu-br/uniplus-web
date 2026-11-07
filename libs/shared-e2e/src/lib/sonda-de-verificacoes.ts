import type { Page } from '@playwright/test';

import { INSTALADORES_DA_LEITURA_DE_ESTILO } from './sonda-de-estilo';
import {
  INSTALADORES_DA_LEITURA_DE_ELEMENTOS,
  instalarSonda,
  type FalhaDeCorte,
  type FalhaTipografica,
  type InstaladorDaSonda,
  type SondaDoNavegador,
} from './sonda-do-navegador';

/** O que uma verificação mediu de errado num elemento, antes de ganhar seletor e texto. */
interface Medida {
  readonly kind: FalhaTipografica['kind'];
  readonly actual: number;
  readonly expected: number;
}

function instalarFalhasDeTipografia(nome: string): void {
  const sonda = (window as unknown as Record<string, SondaDoNavegador>)[nome];
  sonda.falhasDeTipografia = (element, text) => {
    const style = getComputedStyle(element);
    const fontSize = parseFloat(style.fontSize);
    const lineHeight = sonda.parseLineHeight(style.lineHeight, fontSize);
    const letterSpacing = sonda.parseLength(style.letterSpacing);
    const minFontSize = sonda.minimumFontSize(element);
    const medidas: Medida[] = [];
    if (fontSize < minFontSize) {
      medidas.push({ kind: 'font-size', actual: fontSize, expected: minFontSize });
    }
    const semAlturaDeLinhaMinima = !sonda.isInteractive(element) && !sonda.isHeading(element);
    if (semAlturaDeLinhaMinima && lineHeight / fontSize < 1.25) {
      medidas.push({ kind: 'line-height', actual: lineHeight / fontSize, expected: 1.25 });
    }
    if (letterSpacing < 0) {
      medidas.push({ kind: 'letter-spacing', actual: letterSpacing, expected: 0 });
    }
    const selector = sonda.selectorFor(element);
    return medidas.map((m) => ({ ...m, selector, text, actual: sonda.round(m.actual) }));
  };
}

function instalarFalhaDeContraste(nome: string): void {
  const sonda = (window as unknown as Record<string, SondaDoNavegador>)[nome];
  sonda.falhaDeContraste = (element, text, contrastes) => {
    const style = getComputedStyle(element);
    const foreground = sonda.parseColor(style.color);
    const background = sonda.effectiveBackground(element);
    if (!foreground || !background) return [];
    const large = sonda.isLargeText(
      parseFloat(style.fontSize),
      sonda.parseFontWeight(style.fontWeight),
    );
    const expected = large ? contrastes.largeTextContrast : contrastes.normalTextContrast;
    const contrast = sonda.contrastRatio(foreground, background);
    if (contrast >= expected) return [];
    const selector = sonda.selectorFor(element);
    return [{ kind: 'contrast', selector, text, actual: sonda.round(contrast), expected }];
  };
}

function instalarFalhasTipograficas(nome: string): void {
  const sonda = (window as unknown as Record<string, SondaDoNavegador>)[nome];
  sonda.falhasTipograficas = (element, contrastes) => {
    const ignorado =
      !sonda.isVisible(element) || sonda.isDisabled(element) || sonda.isIgnoredTextElement(element);
    const text = ignorado ? '' : sonda.ownText(element);
    if (!text) return [];
    return [
      ...sonda.falhasDeTipografia(element, text),
      ...sonda.falhaDeContraste(element, text, contrastes),
    ];
  };
}

function instalarFalhasDeCorte(nome: string): void {
  const sonda = (window as unknown as Record<string, SondaDoNavegador>)[nome];
  const clips = (value: string): boolean => value === 'hidden' || value === 'clip';
  sonda.falhasDeCorte = (element) => {
    const visivelComTexto =
      sonda.isVisible(element) && sonda.hasOwnText(element) && !sonda.isScreenReaderOnly(element);
    if (!visivelComTexto) return [];
    const style = getComputedStyle(element);
    const selector = sonda.selectorFor(element);
    const text = sonda.compactText(element);
    const falhas: FalhaDeCorte[] = [];
    const registrar = (axis: FalhaDeCorte['axis'], scrollSize: number, clientSize: number) =>
      falhas.push({ selector, text, axis, scrollSize, clientSize });
    if (clips(style.overflowX) && element.scrollWidth > element.clientWidth + 1) {
      registrar('x', element.scrollWidth, element.clientWidth);
    }
    if (clips(style.overflowY) && element.scrollHeight > element.clientHeight + 1) {
      registrar('y', element.scrollHeight, element.clientHeight);
    }
    return falhas;
  };
}

/** Depois dos instaladores de leitura de elementos e de estilo. */
export const INSTALADORES_DAS_VERIFICACOES: readonly InstaladorDaSonda[] = [
  instalarFalhasDeTipografia,
  instalarFalhaDeContraste,
  instalarFalhasTipograficas,
  instalarFalhasDeCorte,
];

/** Instala na página a sonda inteira: leitura de elementos, de estilo e as verificações. */
export async function instalarSondaCompleta(page: Page): Promise<void> {
  await instalarSonda(page, [
    ...INSTALADORES_DA_LEITURA_DE_ELEMENTOS,
    ...INSTALADORES_DA_LEITURA_DE_ESTILO,
    ...INSTALADORES_DAS_VERIFICACOES,
  ]);
}
