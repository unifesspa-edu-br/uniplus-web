import { ElementRef, Injector, Signal, afterNextRender, effect, inject } from '@angular/core';

export interface OpcoesDoFocoDoRecorte {
  /** A leitura nova desfez o filtro e, com ele, os campos que dependiam da opção. */
  readonly filtroRemovido: Signal<boolean>;
  /** Seletores do destino, do preferido ao último: o primeiro que existir recebe o foco. */
  readonly destinos: readonly string[];
}

/**
 * Quando a leitura desfaz o filtro, o campo de município ou de UF (ou o recorte inteiro, se o
 * dataset esvaziou) sai da tela, e o foco que estava nele cairia no corpo da página. O foco só é
 * movido se estava dentro do recorte e o elemento que o tinha deixou de existir.
 *
 * Chamar em contexto de injeção, no componente da página que contém o recorte.
 */
export function devolverFocoDoRecorte(opcoes: OpcoesDoFocoDoRecorte): void {
  const raiz = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  const injector = inject(Injector);

  const devolver = (focado: Element): void => {
    const destinos = opcoes.destinos.map((seletor) => raiz.querySelector<HTMLElement>(seletor));
    if (!focado.isConnected) destinos.find(Boolean)?.focus();
  };

  effect(() => {
    const focado = opcoes.filtroRemovido() ? focoNoRecorte(raiz) : null;
    if (focado) afterNextRender(() => devolver(focado), { injector });
  });
}

function focoNoRecorte(raiz: HTMLElement): Element | null {
  const focado = document.activeElement;
  return focado && raiz.querySelector('cfg-recorte-da-grade')?.contains(focado) ? focado : null;
}
