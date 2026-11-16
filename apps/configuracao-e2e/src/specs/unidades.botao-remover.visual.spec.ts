import { expect, test, type Locator } from '@playwright/test';
import { UNIDADES } from '../support/api-das-unidades';
import { prepararTelaDeUnidades } from '../support/visual-das-unidades';

test.describe('Unidade — cobertura visual DS', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await prepararTelaDeUnidades(page, testInfo);
  });

  test('botão Remover da árvore não tem fundo vermelho permanente, em nenhum nível, tema ou estado de interação (#815)', async ({
    page,
  }) => {
    await page.goto('/unidades');

    const tree = page.locator('.unit-tree');
    await expect(tree).toBeVisible();

    // Expande até o 3º nível (REITORIA → PROEG → CEPS) para cobrir CA-03.
    await tree.locator('> .unit-node > .unit-node__row .unit-node__toggle').click();
    const nodeProeg = tree
      .locator('.unit-node')
      .filter({ has: page.getByRole('button', { name: 'Editar unidade PROEG', exact: true }) })
      .last();
    await nodeProeg.locator('> .unit-node__row .unit-node__toggle').click();

    const removerReitoria = tree.getByRole('button', {
      name: 'Remover unidade REITORIA',
      exact: true,
    });
    const editarReitoria = tree.getByRole('button', {
      name: 'Editar unidade REITORIA',
      exact: true,
    });
    const removerCeps = tree.getByRole('button', { name: 'Remover unidade CEPS', exact: true });

    // CA-01/CA-03 — repouso, em todos os níveis: o fundo do Remover é igual
    // ao do Editar (ambos `btn--tertiary`), nunca a cor sólida de danger.
    const bgRepousoReitoria = await removerReitoria.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(bgRepousoReitoria).toBe(
      await editarReitoria.evaluate((el) => getComputedStyle(el).backgroundColor),
    );

    const bgRepousoCeps = await removerCeps.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bgRepousoCeps).toBe(bgRepousoReitoria);

    // CA-08 — foco por teclado: chega ao botão via Tab real e o foco fica
    // visível (o mesmo `outline` global do DS, não uma borda vermelha
    // específica). Precisa rodar ANTES de qualquer mousedown neste botão —
    // o Chromium suprime `:focus-visible` num elemento que acabou de
    // receber um clique de mouse, então testar isso depois do "pressed"
    // abaixo daria falso negativo.
    await editarReitoria.focus();
    await page.keyboard.press('Tab');
    await expect(removerReitoria).toBeFocused();
    const outlineRemover = await removerReitoria.evaluate(
      (el) => getComputedStyle(el).outlineStyle,
    );
    expect(outlineRemover).not.toBe('none');

    // CA-05 — hover: o Remover tinge exatamente como o Editar (tom do
    // `tertiary`), não um vermelho.
    await removerReitoria.hover();
    await aguardarFundoAssentar(removerReitoria);
    const bgHoverRemover = await removerReitoria.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    await editarReitoria.hover();
    await aguardarFundoAssentar(editarReitoria);
    const bgHoverEditar = await editarReitoria.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(bgHoverRemover).toBe(bgHoverEditar);
    expect(bgHoverRemover).not.toBe(bgRepousoReitoria);

    // CA-05 — pressed: mesmo comportamento do Editar ao segurar o clique.
    // `down` → lê o estilo → `move` para fora ANTES do `up`: solta o clique
    // longe do botão, então nenhum dos dois dispara a ação real (abrir o
    // dialog de confirmação de Remover interceptaria os eventos seguintes
    // destinados ao Editar).
    const centroRemover = await centroDoElemento(removerReitoria);
    await page.mouse.move(centroRemover.x, centroRemover.y);
    await page.mouse.down();
    await aguardarFundoAssentar(removerReitoria);
    const bgPressedRemover = await removerReitoria.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    await page.mouse.move(centroRemover.x - 50, centroRemover.y - 50);
    await page.mouse.up();

    const centroEditar = await centroDoElemento(editarReitoria);
    await page.mouse.move(centroEditar.x, centroEditar.y);
    await page.mouse.down();
    await aguardarFundoAssentar(editarReitoria);
    const bgPressedEditar = await editarReitoria.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    await page.mouse.move(centroEditar.x - 50, centroEditar.y - 50);
    await page.mouse.up();

    expect(bgPressedRemover).toBe(bgPressedEditar);

    // CA-05 — disabled: `recarregandoLista()` da página fica
    // true durante o refetch da lista que segue uma remoção bem-sucedida —
    // não durante o DELETE em si. Resolve o DELETE na hora e atrasa só o GET
    // de recarregamento, para capturar a janela em que a ação fica desabilitada.
    await page.route(/\/api\/organizacao\/admin\/unidades\/.*/, async (route) => {
      await route.fulfill({ status: 204 });
    });
    await page.route(/\/api\/organizacao\/unidades(\?.*)?$/, async (route, request) => {
      if (request.method() !== 'GET') {
        await route.continue();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(UNIDADES),
      });
    });
    await removerReitoria.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Remover', exact: true }).click();
    await expect(removerReitoria).toBeDisabled();
    await expect(editarReitoria).toBeDisabled();
  });
});

/**
 * Espera a transição CSS de `background` (`--duration-fast`, ver
 * `components.css`) assentar, medindo diretamente quando o
 * `backgroundColor` computado para de mudar — em vez de um
 * `page.waitForTimeout()` às cegas, que o lint do repo proíbe.
 */
async function aguardarFundoAssentar(locator: Locator): Promise<void> {
  await locator.evaluate(
    (el) =>
      new Promise<void>((resolve) => {
        // Exige um número mínimo de quadros com o mesmo valor seguidos —
        // parar no primeiro quadro "sem mudança" é cedo demais: a transição
        // às vezes só começa a repintar um ou dois quadros depois do evento
        // (mousedown/hover) que a disparou.
        const QUADROS_ESTAVEIS_NECESSARIOS = 6;
        const LIMITE_DE_QUADROS = 40;
        let anterior = getComputedStyle(el).backgroundColor;
        let estaveisSeguidos = 0;
        let quadros = 0;
        const proximoQuadro = () => {
          requestAnimationFrame(() => {
            const atual = getComputedStyle(el).backgroundColor;
            quadros += 1;
            estaveisSeguidos = atual === anterior ? estaveisSeguidos + 1 : 0;
            anterior = atual;
            if (estaveisSeguidos >= QUADROS_ESTAVEIS_NECESSARIOS || quadros >= LIMITE_DE_QUADROS) {
              resolve();
              return;
            }
            proximoQuadro();
          });
        };
        proximoQuadro();
      }),
  );
}

async function centroDoElemento(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Elemento sem bounding box visível — não é possível calcular o centro.');
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
