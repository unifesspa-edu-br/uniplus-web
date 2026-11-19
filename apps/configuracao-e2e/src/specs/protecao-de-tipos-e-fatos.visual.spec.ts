import { expect, test } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import {
  aoAbrirPeloTeclado,
  clicarNaCelula,
  conferirLista,
  prepararPagina,
  semRolagemHorizontal,
} from '../support/listas-de-tipos-e-fatos';

test.describe('Proteção de dados dos tipos de documento e dos fatos do candidato — fila, decisão e histórico', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await prepararPagina(page, testInfo, 'PENDENTE');
  });

  test('Proteção dos tipos de documento e dos fatos: lista enxuta e drawer com a proposta', async ({
    page,
  }, testInfo) => {
    await page.goto('/protecao-do-catalogo');
    await expect(
      page.getByRole('heading', {
        name: 'Proteção de dados dos tipos de documento e dos fatos do candidato',
        level: 1,
      }),
    ).toBeVisible();
    await expect(page.locator('.page-header__desc')).not.toContainText('UNI-REQ');

    await conferirLista(page, testInfo, {
      colunas: ['Cadastro', 'Item', 'Sensibilidade', 'Ciclo', 'Manifestação'],
      anotacao: 'altura-das-linhas-protecao',
      comAcoes: false,
    });
    await expect(page.locator('.panel tbody')).not.toContainText('LAUDO_MEDICO');

    await clicarNaCelula(page, page.locator('.panel tbody tr').first().locator('td').first());
    const drawer = page.getByRole('dialog', { name: 'Detalhe do item aguardando a decisão' });
    await expect(
      drawer.getByRole('heading', { name: 'Laudo médico complementar', level: 2 }),
    ).toBeFocused();
    await expect(drawer.getByText('Proposta de proteção')).toBeVisible();
    await expect(drawer.getByText('O que é o item')).toBeVisible();
    await expect(drawer.getByText('LAUDO_MEDICO')).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Aprovar' })).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Recomendar ajuste' })).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Reprovar' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('protecao-drawer.png') });
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await aoAbrirPeloTeclado(
      page,
      'Laudo médico complementar',
      'Detalhe do item aguardando a decisão',
    );
  });

  test('Proteção dos tipos de documento e dos fatos: reprovar exige a justificativa, com contador e erro associado', async ({
    page,
  }, testInfo) => {
    await page.goto('/protecao-do-catalogo');
    const drawer = page.getByRole('dialog', { name: 'Detalhe do item aguardando a decisão' });
    await page
      .getByRole('button', { name: 'Ver o detalhe de Laudo médico complementar', exact: true })
      .click();
    await expect(drawer.getByRole('button', { name: 'Reprovar' })).toBeVisible();
    await drawer.getByRole('button', { name: 'Reprovar' }).click();

    const dialogo = page.getByRole('dialog', { name: 'Reprovar a proteção de dados do item' });
    await expect(dialogo).toBeVisible();
    await expect(dialogo).not.toContainText('LAUDO_MEDICO');
    const campo = dialogo.getByRole('textbox', { name: 'Justificativa' });
    await expect(dialogo.getByText('0 de 2.000')).toBeVisible();
    await dialogo.getByRole('button', { name: 'Reprovar item' }).click();
    await expect(dialogo.getByText('Informe a justificativa da reprovação.')).toBeVisible();
    await expect(campo).toBeFocused();
    await expect(campo).toHaveAttribute('aria-invalid', 'true');
    await campo.fill('Falta a base legal.');
    await expect(dialogo.getByText('19 de 2.000')).toBeVisible();
    const axe = await runAxeWcagAA(page);
    expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('protecao-reprovar.png') });

    await page.keyboard.press('Escape');
    await expect(dialogo).toBeHidden();
    await drawer.getByRole('button', { name: 'Recomendar ajuste' }).click();
    const ajuste = page.getByRole('dialog', { name: 'Recomendar ajuste da proteção de dados' });
    await expect(ajuste.getByRole('combobox', { name: 'Classificação recomendada' })).toBeVisible();
    await expect(ajuste.getByRole('textbox', { name: 'Justificativa' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('protecao-recomendar-ajuste.png') });
  });

  test('Proteção dos tipos de documento e dos fatos: abas, filtros na URL e lista de decisões de uma só linha', async ({
    page,
  }, testInfo) => {
    await page.goto('/protecao-do-catalogo');
    const abas = page.getByRole('group', { name: 'Mostrar' });
    await expect(abas.getByRole('button', { name: 'Aguardando decisão' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await abas.getByRole('button', { name: 'Decisões' }).click();
    await expect(page).toHaveURL(/[?&]aba=decisoes/u);
    await expect(
      page.getByRole('heading', { name: 'Decisões registradas', level: 2 }),
    ).toBeVisible();

    await conferirLista(page, testInfo, {
      colunas: ['Item', 'Cadastro', 'Decisão', 'Sensibilidade conferida', 'Data'],
      anotacao: 'altura-das-linhas-decisoes',
      comAcoes: false,
    });
    await expect(page.locator('.panel tbody tr')).toHaveCount(3);

    // Os filtros ficam na URL e a lista os respeita; o bloco recolhido resume os ativos.
    await page.getByRole('button', { name: /^Filtros/u }).click();
    await page.getByRole('button', { name: 'Reprovado', exact: true }).click();
    await expect(page).toHaveURL(/ato=REPROVACAO/u);
    await expect(page.locator('.panel tbody tr')).toHaveCount(1);
    await expect(page.locator('.panel tbody')).toContainText('Renda familiar bruta');
    await expect(page.getByRole('button', { name: 'Reprovado', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: 'Fato do candidato', exact: true }).click();
    await expect(page).toHaveURL(/cadastro=FATO/u);
    await expect(page.getByLabel('Decidido a partir de')).toBeVisible();
    await expect(page.getByLabel('Decidido até')).toBeVisible();
    await expect(page.getByLabel('Só as minhas')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Paginação das decisões' })).toBeVisible();
    const axe = await runAxeWcagAA(page);
    expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('decisoes-filtros.png') });

    // Recarregar a página volta ao mesmo recorte.
    await page.reload();
    await expect(page.getByRole('button', { name: /^Filtros/u })).toContainText('Reprovação');
    await page.getByRole('button', { name: /^Filtros/u }).click();
    await expect(page.getByRole('button', { name: 'Reprovado', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('.panel tbody tr')).toHaveCount(1);
  });

  test('Proteção dos tipos de documento e dos fatos: o drawer da decisão traz a proteção conferida e o histórico do item', async ({
    page,
  }, testInfo) => {
    await page.goto('/protecao-do-catalogo?aba=decisoes');
    await clicarNaCelula(
      page,
      page.locator('.panel tbody tr').first().locator('td[data-label="Cadastro"]'),
    );
    const drawer = page.getByRole('dialog', { name: 'Detalhe da decisão' });
    await expect(
      drawer.getByRole('heading', { name: 'Renda familiar bruta', level: 2 }),
    ).toBeFocused();
    await expect(drawer.getByText('Decidido por')).toBeVisible();
    await expect(drawer.getByText('Betina Marina Valentina das Neves').first()).toBeVisible();
    await expect(drawer.getByText('Proteção conferida')).toBeVisible();
    await expect(
      drawer.getByRole('heading', { name: 'Histórico do item', level: 3 }),
    ).toBeVisible();
    await expect(drawer.locator('.cfg-atos__item')).toHaveCount(3);
    await semRolagemHorizontal(page, drawer.locator('.uni-drawer__body'));
    const axe = await runAxeWcagAA(page);
    expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('decisoes-drawer.png') });
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(
      page.getByRole('button', { name: 'Ver a decisão sobre Renda familiar bruta', exact: true }),
    ).toBeFocused();
  });

  test('cartão a 320 px: as decisões e o histórico não estouram a largura', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto('/protecao-do-catalogo?aba=decisoes');
    await expect(
      page.getByRole('button', { name: 'Ver a decisão sobre Renda familiar bruta', exact: true }),
    ).toBeVisible();
    await semRolagemHorizontal(page, page.locator('html'));
    await page.screenshot({ path: testInfo.outputPath('320-decisoes.png') });
    await clicarNaCelula(page, page.locator('.panel tbody tr').first().locator('td').nth(1));
    const drawer = page.getByRole('dialog', { name: 'Detalhe da decisão' });
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('.cfg-atos__item')).toHaveCount(3);
    const largura = await drawer
      .locator('.uni-drawer__panel')
      .evaluate((el) => el.getBoundingClientRect().width);
    expect(largura).toBeLessThanOrEqual(320);
    await semRolagemHorizontal(page, drawer.locator('.uni-drawer__body'));
    await page.screenshot({ path: testInfo.outputPath('320-decisoes-drawer.png') });
  });
});
