import type { Page } from '@playwright/test';

/**
 * A sonda é o conjunto de leituras do DOM que as verificações de acessibilidade rodam dentro do
 * navegador. O `page.evaluate` serializa uma função só, sem acesso aos módulos, então cada instalador
 * abaixo se carrega inteiro no navegador e registra suas leituras em `window[nome]`, onde as outras
 * verificações as encontram.
 */
export interface SondaDoNavegador {
  isVisible(element: HTMLElement): boolean;
  isDisabled(element: HTMLElement): boolean;
  isIgnoredTextElement(element: HTMLElement): boolean;
  isScreenReaderOnly(element: HTMLElement): boolean;
  isInteractive(element: HTMLElement): boolean;
  isHeading(element: HTMLElement): boolean;
  selectorFor(element: HTMLElement): string;
  compactText(element: HTMLElement): string;
  hasOwnText(element: HTMLElement): boolean;
  ownText(element: HTMLElement): string;
  round(value: number): number;
  parseFontWeight(fontWeight: string): number;
  parseLineHeight(lineHeight: string, fontSize: number): number;
  parseLength(value: string): number;
  isLargeText(fontSize: number, fontWeight: number): boolean;
  minimumFontSize(element: HTMLElement): number;
  parseColor(value: string): Cor | null;
  blend(foreground: Cor, background: Cor): Cor;
  effectiveBackground(element: HTMLElement): Cor | null;
  contrastRatio(foreground: Cor, background: Cor): number;
  falhasDeTipografia(element: HTMLElement, text: string): FalhaTipografica[];
  falhaDeContraste(
    element: HTMLElement,
    text: string,
    contrastes: ContrastesExigidos,
  ): FalhaTipografica[];
  falhasTipograficas(element: HTMLElement, contrastes: ContrastesExigidos): FalhaTipografica[];
  falhasDeCorte(element: HTMLElement): FalhaDeCorte[];
}

export interface Cor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface ContrastesExigidos {
  readonly normalTextContrast: number;
  readonly largeTextContrast: number;
}

export interface FalhaTipografica {
  kind: 'contrast' | 'font-size' | 'line-height' | 'letter-spacing';
  selector: string;
  text: string;
  actual: number;
  expected: number;
}

export interface FalhaDeCorte {
  selector: string;
  text: string;
  axis: 'x' | 'y';
  scrollSize: number;
  clientSize: number;
}

/** Onde a sonda se registra no `window` da página. */
export const NOME_DA_SONDA = '__uniplusSondaDeAcessibilidade';

/** Cada instalador roda no navegador: não pode citar nada fora do próprio corpo. */
export type InstaladorDaSonda = (nome: string) => void;

function instalarVisibilidade(nome: string): void {
  const sonda = ((window as unknown as Record<string, SondaDoNavegador>)[nome] ??=
    {} as SondaDoNavegador);
  sonda.isVisible = (element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      Number(style.opacity) !== 0 &&
      rect.width > 0 &&
      rect.height > 0
    );
  };
  sonda.isDisabled = (element) =>
    element.matches('[disabled], [aria-disabled="true"], :disabled') ||
    element.closest('[disabled], [aria-disabled="true"], :disabled') !== null;
  sonda.isIgnoredTextElement = (element) =>
    element.matches(
      ['script', 'style', 'svg', 'path', '[aria-hidden="true"]', '[hidden]', '.sr-only'].join(','),
    );
  // `.sr-only` recorta o próprio conteúdo em 1x1px de propósito — não é o clipping de conteúdo
  // visível que a verificação de corte procura. Texto `aria-hidden` mas visível a olho nu (a marca
  // "U+", as iniciais do avatar) continua sob checagem: quem enxerga vê esse texto.
  sonda.isScreenReaderOnly = (element) => element.matches('.sr-only');
}

function instalarClassificacaoDosElementos(nome: string): void {
  const sonda = (window as unknown as Record<string, SondaDoNavegador>)[nome];
  sonda.isInteractive = (element) =>
    element.matches(
      [
        'a[href]',
        'button',
        'input',
        'select',
        'textarea',
        'summary',
        '[role="button"]',
        '[role="link"]',
        '[role="menuitem"]',
        '[tabindex]:not([tabindex="-1"])',
      ].join(','),
    );
  sonda.isHeading = (element) =>
    /^H[1-6]$/.test(element.tagName) || element.getAttribute('role') === 'heading';
}

function instalarIdentificacaoDosElementos(nome: string): void {
  const sonda = (window as unknown as Record<string, SondaDoNavegador>)[nome];
  sonda.selectorFor = (element) => {
    const testId = element.getAttribute('data-testid');
    if (testId) return `[data-testid="${testId}"]`;
    if (element.id) return `#${element.id}`;
    const className = Array.from(element.classList).slice(0, 2).join('.');
    return className ? `${element.localName}.${className}` : element.localName;
  };
  sonda.compactText = (element) =>
    (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  sonda.round = (value) => Math.round(value * 100) / 100;
}

function instalarTextoProprio(nome: string): void {
  const sonda = (window as unknown as Record<string, SondaDoNavegador>)[nome];
  sonda.hasOwnText = (element) =>
    Array.from(element.childNodes).some(
      (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim().length > 0,
    );
  sonda.ownText = (element) => {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      const valor = element.value || element.placeholder || element.getAttribute('aria-label');
      return (valor || '').trim();
    }
    const directText = Array.from(element.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (directText) return directText.slice(0, 80);
    return sonda.isInteractive(element) ? sonda.compactText(element) : '';
  };
}

/** A ordem importa: cada instalador usa leituras dos anteriores. */
export const INSTALADORES_DA_LEITURA_DE_ELEMENTOS: readonly InstaladorDaSonda[] = [
  instalarVisibilidade,
  instalarClassificacaoDosElementos,
  instalarIdentificacaoDosElementos,
  instalarTextoProprio,
];

export async function instalarSonda(
  page: Page,
  instaladores: readonly InstaladorDaSonda[],
): Promise<void> {
  for (const instalar of instaladores) {
    await page.evaluate(instalar, NOME_DA_SONDA);
  }
}
