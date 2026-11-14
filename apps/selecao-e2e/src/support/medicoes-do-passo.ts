import type { Page } from '@playwright/test';
import type { AxeResults } from 'axe-core';

/** Quanto a página e o conteúdo do passo rolam na horizontal, em px. */
export async function medirTransbordo(
  page: Page,
): Promise<{ documento: number; scroller: number }> {
  return page.evaluate(() => {
    const documento = document.documentElement;
    const scroller = document.querySelector('.wiz-content');
    return {
      documento: documento.scrollWidth - documento.clientWidth,
      scroller: scroller instanceof HTMLElement ? scroller.scrollWidth - scroller.clientWidth : 0,
    };
  });
}

/** Falhar por id diz qual regra caiu; a coleção crua não. */
export function identificadoresDe(resultado: AxeResults): string[] {
  return resultado.violations.map((violacao) => violacao.id);
}
