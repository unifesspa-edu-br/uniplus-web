import type { InstaladorDaSonda, SondaDoNavegador } from './sonda-do-navegador';

function instalarLeituraDeMedidas(nome: string): void {
  const sonda = (window as unknown as Record<string, SondaDoNavegador>)[nome];
  sonda.parseFontWeight = (fontWeight) => {
    if (fontWeight === 'normal') return 400;
    if (fontWeight === 'bold') return 700;
    return Number.parseInt(fontWeight, 10) || 400;
  };
  sonda.parseLineHeight = (lineHeight, fontSize) => {
    if (lineHeight === 'normal') return fontSize * 1.2;
    if (lineHeight.endsWith('px')) return parseFloat(lineHeight);
    const numeric = Number(lineHeight);
    return Number.isFinite(numeric) ? numeric * fontSize : fontSize * 1.2;
  };
  sonda.parseLength = (value) => (value === 'normal' ? 0 : parseFloat(value) || 0);
  sonda.isLargeText = (fontSize, fontWeight) =>
    fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
}

function instalarTamanhoMinimoDaFonte(nome: string): void {
  const sonda = (window as unknown as Record<string, SondaDoNavegador>)[nome];
  sonda.minimumFontSize = (element) => {
    if (
      element.matches(
        // .tag/.filter-chip__count/.u-eyebrow: rótulos curtos e decorativos
        // (status, contagem, legenda em caixa alta), mesmo racional de .card__meta
        // e .u-caption — não são texto de corpo.
        '.u-caption, .card__meta, .table-responsive__meta, .institutional-bar, .institutional-bar *, .tag, .filter-chip__count, .u-eyebrow',
      )
    ) {
      return 12;
    }
    if (sonda.isInteractive(element) || element.matches('th, .u-body-sm, .page-header__desc')) {
      return 14;
    }
    return sonda.isHeading(element) ? 18 : 14;
  };
}

function instalarLeituraDeCor(nome: string): void {
  const sonda = (window as unknown as Record<string, SondaDoNavegador>)[nome];
  const comCanais = (partes: number[], escala: number) =>
    partes.length >= 3 && partes.every((parte) => Number.isFinite(parte))
      ? {
          r: partes[0] * escala,
          g: partes[1] * escala,
          b: partes[2] * escala,
          a: partes.length >= 4 ? partes[3] : 1,
        }
      : null;
  sonda.parseColor = (value) => {
    const rgba = value.match(/^rgba?\(([^)]+)\)$/);
    if (rgba) {
      return comCanais(
        rgba[1].split(/,\s*/).map((parte) => Number(parte.trim().replace('%', ''))),
        1,
      );
    }
    const srgb = value.match(/^color\(srgb\s+([^)]+)\)$/);
    return srgb
      ? comCanais(
          srgb[1].split(/\s+/).map((parte) => Number(parte)),
          255,
        )
      : null;
  };
}

function instalarMisturaDeCores(nome: string): void {
  const sonda = (window as unknown as Record<string, SondaDoNavegador>)[nome];
  sonda.blend = (foreground, background) => {
    const alpha = foreground.a + background.a * (1 - foreground.a);
    if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 };
    const canal = (frente: number, fundo: number): number =>
      (frente * foreground.a + fundo * background.a * (1 - foreground.a)) / alpha;
    return {
      r: canal(foreground.r, background.r),
      g: canal(foreground.g, background.g),
      b: canal(foreground.b, background.b),
      a: alpha,
    };
  };
}

function instalarFundoEfetivo(nome: string): void {
  const sonda = (window as unknown as Record<string, SondaDoNavegador>)[nome];
  const prefersDarkCanvas = (): boolean => {
    const rootTheme = document.documentElement.dataset['theme'];
    return rootTheme === 'dark' || rootTheme === 'contrast';
  };
  sonda.effectiveBackground = (element) => {
    let color = prefersDarkCanvas() ? { r: 0, g: 0, b: 0, a: 1 } : { r: 255, g: 255, b: 255, a: 1 };
    const chain: HTMLElement[] = [];
    for (let current: HTMLElement | null = element; current; current = current.parentElement) {
      chain.unshift(current);
    }
    for (const item of chain) {
      const background = sonda.parseColor(getComputedStyle(item).backgroundColor);
      if (background && background.a > 0) {
        color = sonda.blend(background, color);
      }
    }
    return color;
  };
}

function instalarRazaoDeContraste(nome: string): void {
  const sonda = (window as unknown as Record<string, SondaDoNavegador>)[nome];
  const relativeLuminance = (color: { r: number; g: number; b: number }): number => {
    const [r, g, b] = [color.r, color.g, color.b]
      .map((channel) => channel / 255)
      .map((channel) =>
        channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
      );
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  sonda.contrastRatio = (foreground, background) => {
    const fg = relativeLuminance(foreground);
    const bg = relativeLuminance(background);
    return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
  };
}

/** Depois dos instaladores de leitura de elementos: estes usam `isInteractive`, `isHeading` e afins. */
export const INSTALADORES_DA_LEITURA_DE_ESTILO: readonly InstaladorDaSonda[] = [
  instalarLeituraDeMedidas,
  instalarTamanhoMinimoDaFonte,
  instalarLeituraDeCor,
  instalarMisturaDeCores,
  instalarFundoEfetivo,
  instalarRazaoDeContraste,
];
