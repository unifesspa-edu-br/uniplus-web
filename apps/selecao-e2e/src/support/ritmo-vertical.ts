import type { Page } from '@playwright/test';

/**
 * Pares de blocos visíveis do passo mais próximos que o ritmo vertical pede:
 * - título de seção a menos de 20 px do bloco anterior;
 * - alerta ou dica a menos de 16 px do bloco seguinte.
 *
 * Quando a dica encerra o contêiner (campo, cabeçalho, linha de ações), a medida vai do
 * contêiner até o irmão dele, desde que esse irmão seja um bloco de largura inteira: um
 * item de grade ao lado fica na mesma linha e não tem distância vertical a conferir.
 *
 * A dica que antecede o próprio controle, outra dica ou a base legal da regra escolhida
 * no campo (`.regra-explicada`, que detalha o campo de cima) fica de fora: ali a
 * proximidade é intencional.
 */
export async function blocosColados(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const raiz = document.querySelector('.wiz-content');
    if (!raiz) {
      return ['.wiz-content ausente'];
    }
    const visivel = (e: Element | null): e is Element =>
      e !== null && e.getBoundingClientRect().height > 0;
    const anterior = (e: Element): Element | null => {
      let irmao = e.previousElementSibling;
      while (irmao && !visivel(irmao)) irmao = irmao.previousElementSibling;
      return irmao;
    };
    const seguinte = (e: Element): Element | null => {
      let irmao = e.nextElementSibling;
      while (irmao && !visivel(irmao)) irmao = irmao.nextElementSibling;
      return irmao;
    };
    const distancia = (de: Element, para: Element): number =>
      para.getBoundingClientRect().top - de.getBoundingClientRect().bottom;
    const texto = (e: Element): string => (e.textContent ?? '').trim().slice(0, 40);
    const PROXIMIDADE_INTENCIONAL =
      'input, select, textarea, label, .input, .field__hint, .field__erro, .regra-explicada';
    const LARGURA_INTEIRA = 'details, .field__hint, .alert, .form-grid, .checkbox-grid';
    const colados: string[] = [];

    for (const titulo of raiz.querySelectorAll('.step-section__title, .form-section__title')) {
      const antes = visivel(titulo) ? anterior(titulo) : null;
      if (antes && distancia(antes, titulo) < 20) {
        colados.push(`título "${texto(titulo)}"`);
      }
    }

    for (const bloco of raiz.querySelectorAll('.alert, .field__hint')) {
      if (!visivel(bloco)) continue;
      const depois = seguinte(bloco);
      if (depois) {
        if (!depois.matches(PROXIMIDADE_INTENCIONAL) && distancia(bloco, depois) < 16) {
          colados.push(`bloco "${texto(bloco)}"`);
        }
        continue;
      }
      const pai = bloco.parentElement;
      const irmaoDoPai = pai && pai !== raiz ? seguinte(pai) : null;
      if (pai && irmaoDoPai?.matches(LARGURA_INTEIRA) && distancia(pai, irmaoDoPai) < 16) {
        colados.push(`contêiner da dica "${texto(bloco)}"`);
      }
    }
    return colados;
  });
}
