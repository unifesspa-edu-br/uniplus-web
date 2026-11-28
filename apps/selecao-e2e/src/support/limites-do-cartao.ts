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
  return page.locator('.wiz-content .step-card *').evaluateAll((elementos) =>
    elementos
      .filter((e) => e.children.length === 0 && e.getBoundingClientRect().width > 0)
      .filter((e) => !e.closest('.table-responsive') || window.innerWidth < 768)
      .filter((e) => {
        const cartao = e.closest('.step-card') ?? e;
        const limite =
          cartao.getBoundingClientRect().right - parseFloat(getComputedStyle(cartao).paddingRight);
        return e.getBoundingClientRect().right > limite + 1;
      })
      .map((e) => `${e.tagName}: ${(e.textContent ?? '').trim().slice(0, 30)}`),
  );
}
