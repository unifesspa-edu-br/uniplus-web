import axe from 'axe-core';

const REGIAO_VIVA = '[aria-live]:not([aria-live="off"]), [role="status"], [role="alert"]';

/** A região viva mais próxima que envolve o elemento, ou nulo quando ele não está em nenhuma. */
export function regiaoVivaQueEnvolve(elemento: Element): Element | null {
  return elemento.closest(REGIAO_VIVA);
}

/**
 * O jsdom não calcula geometria nem desenha: sem estes retornos o axe desiste das regras de rótulo e
 * de ARIA, e o contraste fica a cargo do E2E. Devolve a função que repõe o que o documento tinha.
 */
export function simularGeometriaDoDocumento(): () => void {
  const { elementFromPoint, elementsFromPoint } = document;
  document.elementFromPoint = () => null;
  document.elementsFromPoint = () => [];
  return () => {
    document.elementFromPoint = elementFromPoint;
    document.elementsFromPoint = elementsFromPoint;
  };
}

export function conferirAcessibilidade(raiz: HTMLElement): Promise<axe.AxeResults> {
  return axe.run(raiz, {
    rules: { region: { enabled: false }, 'color-contrast': { enabled: false } },
  });
}
