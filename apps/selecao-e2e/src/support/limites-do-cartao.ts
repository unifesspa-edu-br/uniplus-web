import type { Page } from '@playwright/test';

/**
 * Folhas do passo que passam da borda do conteúdo do cartão que as contém. A medida por
 * elemento pega o que a da área de trabalho não pega: o `.page` corta o excesso, e o que é
 * cortado some sem rolagem.
 *
 * A tabela que rola dentro da própria caixa (`.table-responsive`, acima de 768 px) fica de
 * fora: ali o conteúdo além da borda é alcançado pela rolagem dela.
 */
export async function elementosForaDoCartao(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const fora: string[] = [];
    for (const elemento of Array.from(document.querySelectorAll('.wiz-content .step-card *'))) {
      const caixa = elemento.getBoundingClientRect();
      if (caixa.width === 0 || elemento.children.length > 0) continue;
      if (elemento.closest('.table-responsive') && window.innerWidth >= 768) continue;
      const cartao = elemento.closest('.step-card');
      if (!cartao) continue;
      const borda = cartao.getBoundingClientRect().right;
      const limite = borda - parseFloat(getComputedStyle(cartao).paddingRight);
      if (caixa.right > limite + 1) {
        fora.push(`${elemento.tagName}: ${(elemento.textContent ?? '').trim().slice(0, 30)}`);
      }
    }
    return fora;
  });
}
