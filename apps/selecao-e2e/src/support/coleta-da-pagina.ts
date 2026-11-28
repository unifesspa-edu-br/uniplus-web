import type { Page } from '@playwright/test';

/**
 * Fotografia do DOM em dados simples. Cada coleta roda numa única chamada à página, para que
 * todos os elementos sejam medidos no mesmo instante; as decisões ficam no Node.
 */

export interface Retangulo {
  readonly top: number;
  readonly bottom: number;
  readonly height: number;
}

export interface NoDaPagina {
  /** Posição do elemento pai na coleta; -1 para a raiz. */
  readonly pai: number;
  readonly tag: string;
  readonly classes: readonly string[];
  readonly retangulo: Retangulo;
}

export interface NoComTexto extends NoDaPagina {
  /** Texto do elemento sem espaços nas pontas, cortado em 40 caracteres. */
  readonly texto: string;
}

export type PropriedadeDeEstilo =
  | 'position'
  | 'display'
  | 'border-top-width'
  | 'border-bottom-width'
  | 'padding-top'
  | 'padding-bottom'
  | 'background-color'
  | 'overflow';

export type EstiloDoNo = Readonly<Record<PropriedadeDeEstilo, string>>;

export interface NoComEstilo extends NoDaPagina {
  readonly oculto: boolean;
  /** Todo o texto do elemento, inclusive o dos descendentes. */
  readonly textoCompleto: string;
  readonly estilo: EstiloDoNo;
}

export interface Arvore<T extends NoDaPagina> {
  readonly nos: readonly T[];
  readonly filhos: readonly (readonly number[])[];
}

const PROPRIEDADES_DE_ESTILO: readonly PropriedadeDeEstilo[] = [
  'position',
  'display',
  'border-top-width',
  'border-bottom-width',
  'padding-top',
  'padding-bottom',
  'background-color',
  'overflow',
];

// As duas funções abaixo rodam dentro da página: usam só o DOM e o que recebem como argumento.

function fotografarNosComTexto(seletor: string): NoComTexto[] {
  const raiz = document.querySelector(seletor);
  const elementos = raiz ? [raiz, ...raiz.querySelectorAll('*')] : [];
  return elementos.map((elemento) => ({
    pai: elementos.indexOf(elemento.parentElement as Element),
    tag: elemento.localName,
    classes: [...elemento.classList],
    texto: (elemento.textContent ?? '').trim().slice(0, 40),
    retangulo: elemento.getBoundingClientRect().toJSON(),
  }));
}

interface PedidoComEstilo {
  readonly seletor: string;
  readonly propriedades: readonly PropriedadeDeEstilo[];
}

function fotografarNosComEstilo({ seletor, propriedades }: PedidoComEstilo): NoComEstilo[] {
  const raiz = document.querySelector(seletor);
  const elementos = raiz ? [raiz, ...raiz.querySelectorAll('*')] : [];
  return elementos.map((elemento) => ({
    pai: elementos.indexOf(elemento.parentElement as Element),
    tag: elemento.localName,
    classes: [...elemento.classList],
    oculto: elemento.hasAttribute('hidden'),
    textoCompleto: elemento.textContent ?? '',
    retangulo: elemento.getBoundingClientRect().toJSON(),
    estilo: Object.fromEntries(
      propriedades.map((p) => [p, getComputedStyle(elemento).getPropertyValue(p)]),
    ) as EstiloDoNo,
  }));
}

/** A raiz e seus descendentes, na ordem do documento; lista vazia se a raiz não existe. */
export async function coletarNosComTexto(page: Page, seletor: string): Promise<NoComTexto[]> {
  return page.evaluate(fotografarNosComTexto, seletor);
}

/** A raiz e seus descendentes, na ordem do documento, com o estilo calculado de cada um. */
export async function coletarNosComEstilo(page: Page, seletor: string): Promise<NoComEstilo[]> {
  return page.evaluate(fotografarNosComEstilo, { seletor, propriedades: PROPRIEDADES_DE_ESTILO });
}

export function montarArvore<T extends NoDaPagina>(nos: readonly T[]): Arvore<T> {
  const filhos: number[][] = nos.map(() => []);
  nos.forEach((no, indice) => {
    if (no.pai >= 0) filhos[no.pai].push(indice);
  });
  return { nos, filhos };
}

export function ehVisivel(no: NoDaPagina): boolean {
  return no.retangulo.height > 0;
}

/** O irmão visível mais próximo, antes (-1) ou depois (1) do nó, ou nulo se não houver. */
export function irmaoVisivel<T extends NoDaPagina>(
  arvore: Arvore<T>,
  indice: number,
  sentido: -1 | 1,
): number | null {
  const irmaos = arvore.filhos[arvore.nos[indice].pai] ?? [];
  const posicao = irmaos.indexOf(indice);
  const candidatos = sentido === 1 ? irmaos.slice(posicao + 1) : irmaos.slice(0, posicao).reverse();
  return candidatos.find((candidato) => ehVisivel(arvore.nos[candidato])) ?? null;
}

export function distanciaVertical(de: Retangulo, para: Retangulo): number {
  return para.top - de.bottom;
}
