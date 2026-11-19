import { expect, test } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import {
  aoAbrirPeloTeclado,
  caixa,
  clicarNaCelula,
  conferirLista,
  prepararPagina,
  semRolagemHorizontal,
  tema,
} from '../support/listas-de-tipos-e-fatos';

test.describe('Listas de tipos de documento e de fatos do candidato — linha clicável e detalhe no drawer', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await prepararPagina(page, testInfo, 'PENDENTE');
  });

  test('Tipo de Documento: colunas, linha de uma só linha, abertura por clique e teclado', async ({
    page,
  }, testInfo) => {
    await page.goto('/tipos-documento');
    await expect(page.getByRole('heading', { name: 'Tipo de Documento', level: 1 })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', tema(testInfo));
    await conferirLista(page, testInfo, {
      colunas: ['Código', 'Nome', 'Categoria', 'Formatos aceitos', 'Sensibilidade', 'Situação'],
      anotacao: 'altura-das-linhas-tipos-documento',
    });

    // Clicar em qualquer ponto da linha abre o detalhe; a ação da linha não.
    const linha = page.locator('.panel tbody tr').first();
    await clicarNaCelula(page, linha.locator('td[data-label="Categoria"]'));
    const drawer = page.getByRole('dialog', { name: 'Detalhe do tipo de documento' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('heading', { name: 'Registro Geral', level: 2 })).toBeFocused();
    await expect(drawer.getByText('Documento de identificação civil.')).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Editar' })).toBeVisible();
    const axe = await runAxeWcagAA(page);
    expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('tipos-documento-drawer.png') });
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();

    await page.getByRole('button', { name: 'Editar tipo de documento RG', exact: true }).click();
    const formulario = page.getByRole('dialog', { name: 'Formulário de tipo de documento' });
    await expect(formulario).toBeVisible();
    await expect(drawer).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(formulario).toBeHidden();

    await aoAbrirPeloTeclado(page, 'Registro Geral', 'Detalhe do tipo de documento');
  });

  test('Tipo de Documento: abre e fecha pelo teclado, com o foco no título e de volta ao nome', async ({
    page,
  }) => {
    await page.goto('/tipos-documento');
    await expect(page.getByRole('heading', { name: 'Tipo de Documento', level: 1 })).toBeVisible();
    await aoAbrirPeloTeclado(page, 'Registro Geral', 'Detalhe do tipo de documento');
  });

  test('Tipo de Documento: Editar a partir do detalhe devolve o foco à linha ao fechar', async ({
    page,
  }) => {
    await page.goto('/tipos-documento');
    const alvo = page.getByRole('button', { name: 'Ver o detalhe de Registro Geral', exact: true });
    await alvo.click();
    await page
      .getByRole('dialog', { name: 'Detalhe do tipo de documento' })
      .getByRole('button', { name: 'Editar' })
      .click();
    const edicao = page.getByRole('dialog', { name: 'Formulário de tipo de documento' });
    await expect(edicao).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(edicao).toBeHidden();
    await expect(alvo).toBeFocused();
  });

  test('Fato do Candidato: colunas, linha de uma só linha e detalhe com valores e orientação', async ({
    page,
  }, testInfo) => {
    await page.goto('/fatos-candidato');
    await expect(page.getByRole('heading', { name: 'Fato do Candidato', level: 1 })).toBeVisible();
    await conferirLista(page, testInfo, {
      colunas: [
        'Código',
        'Nome',
        'Origem',
        'Tipo de dado',
        'Situação',
        'Sensibilidade',
        'Aprovação',
      ],
      anotacao: 'altura-das-linhas-fatos',
    });

    await clicarNaCelula(
      page,
      page.locator('.panel tbody tr').first().locator('td[data-label="Origem"]'),
    );
    const drawer = page.getByRole('dialog', { name: 'Detalhe do fato do candidato' });
    await expect(
      drawer.getByRole('heading', { name: 'Identidade de gênero', level: 2 }),
    ).toBeFocused();
    await expect(
      drawer.getByText('Marque se a identidade coincide com o sexo de nascimento.'),
    ).toBeVisible();
    await expect(drawer.getByText('Classificação recomendada: Pessoal sensível')).toBeVisible();
    await expect(
      drawer.getByText('Justificativa: O dado revela a identidade de gênero.'),
    ).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Aceitar recomendação' })).toBeVisible();
    const axe = await runAxeWcagAA(page);
    expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('fatos-drawer.png') });
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();

    await aoAbrirPeloTeclado(page, 'Identidade de gênero', 'Detalhe do fato do candidato');
  });

  test('cartão a 320 px: sem rolagem horizontal, com o alvo estendido e o drawer na largura da tela', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 700 });
    for (const [rota, nome, ariaDoDrawer] of [
      ['/tipos-documento', 'Registro Geral', 'Detalhe do tipo de documento'],
      ['/fatos-candidato', 'Identidade de gênero', 'Detalhe do fato do candidato'],
      [
        '/protecao-do-catalogo',
        'Laudo médico complementar',
        'Detalhe do item aguardando a decisão',
      ],
    ] as const) {
      await page.goto(rota);
      await expect(
        page.getByRole('button', { name: `Ver o detalhe de ${nome}`, exact: true }),
      ).toBeVisible();
      await semRolagemHorizontal(page, page.locator('html'));
      await clicarNaCelula(page, page.locator('.panel tbody tr').first().locator('td').nth(1));
      const drawer = page.getByRole('dialog', { name: ariaDoDrawer });
      await expect(drawer).toBeVisible();
      const largura = await drawer
        .locator('.uni-drawer__panel')
        .evaluate((el) => el.getBoundingClientRect().width);
      expect(largura).toBeLessThanOrEqual(320);
      await semRolagemHorizontal(page, drawer.locator('.uni-drawer__body'));
      await page.screenshot({ path: testInfo.outputPath(`320-${rota.slice(1)}.png`) });
      await page.keyboard.press('Escape');
      await expect(drawer).toBeHidden();
    }
  });

  test('Tipo de Documento: o drawer mostra o histórico da proteção em ordem, com quem agiu e a justificativa', async ({
    page,
  }, testInfo) => {
    await page.goto('/tipos-documento');
    await page
      .getByRole('button', { name: 'Ver o detalhe de Laudo médico complementar', exact: true })
      .click();
    const drawer = page.getByRole('dialog', { name: 'Detalhe do tipo de documento' });
    const secao = drawer.locator('section', {
      has: page.getByRole('heading', { name: 'Histórico da proteção', level: 3 }),
    });
    await expect(secao.locator('.cfg-atos__item')).toHaveCount(3);
    await expect(secao.locator('.cfg-atos__item').nth(0)).toContainText('Solicitação');
    await expect(secao.locator('.cfg-atos__item').nth(1)).toContainText('Ajuste recomendado');
    await expect(secao.locator('.cfg-atos__item').nth(1)).toContainText('Caroline Stefany Jesus');
    await expect(secao.locator('.cfg-atos__item').nth(1)).toContainText(
      'Classificação recomendada: Pessoal',
    );
    await expect(secao.locator('.cfg-atos__item').nth(1)).toContainText(
      'O laudo identifica o candidato e traz dado de saúde.',
    );
    await expect(secao.locator('.cfg-atos__item').nth(2)).toContainText('Aceite da recomendação');
    await expect(secao.locator('.cfg-atos__item').nth(2)).toContainText('31/10/2026');
    await semRolagemHorizontal(page, drawer.locator('.uni-drawer__body'));
    const axe = await runAxeWcagAA(page);
    expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
    await secao.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('tipos-documento-historico.png') });
  });

  test('Fato do Candidato: o drawer mostra o histórico, inclusive a reprovação que a correção não apagou', async ({
    page,
  }, testInfo) => {
    await page.goto('/fatos-candidato');
    await page
      .getByRole('button', { name: 'Ver o detalhe de Renda familiar bruta', exact: true })
      .click();
    const drawer = page.getByRole('dialog', { name: 'Detalhe do fato do candidato' });
    const secao = drawer.locator('section', {
      has: page.getByRole('heading', { name: 'Histórico da proteção', level: 3 }),
    });
    await expect(secao.locator('.cfg-atos__item')).toHaveCount(3);
    await expect(secao.locator('.cfg-atos__item').nth(1)).toContainText('Reprovação');
    await expect(secao.locator('.cfg-atos__item').nth(1)).toContainText(
      'Betina Marina Valentina das Neves',
    );
    await expect(secao.locator('.cfg-atos__item').nth(1)).toContainText(
      'Justificativa: A renda familiar bruta',
    );
    await semRolagemHorizontal(page, drawer.locator('.uni-drawer__body'));
    const axe = await runAxeWcagAA(page);
    expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
    await secao.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('fatos-historico.png') });
  });

  test('Enviar solicitação: o diálogo largo cabe sem rolagem horizontal e sem código técnico', async ({
    page,
  }, testInfo) => {
    await page.goto('/tipos-documento');
    await page.getByRole('button', { name: 'Enviar solicitação', exact: true }).click();
    const dialogo = page.getByRole('dialog', { name: 'Enviar solicitação de aprovação' });
    await expect(dialogo).toBeVisible();
    await expect(dialogo.locator('thead th')).toHaveText([
      'Enviar',
      'Cadastro',
      'Item',
      'Sensibilidade',
    ]);
    await expect(dialogo.getByRole('button', { name: 'Enviar 2 itens' })).toBeEnabled();
    await expect(
      dialogo.getByRole('checkbox', { name: 'Enviar Laudo médico complementar' }),
    ).toBeChecked();
    await caixa(dialogo, 'Enviar Renda familiar bruta').click();
    await expect(dialogo.getByRole('button', { name: 'Enviar 1 item' })).toBeEnabled();
    await expect(dialogo.getByRole('checkbox', { name: 'Marcar todos os itens' })).toHaveJSProperty(
      'indeterminate',
      true,
    );
    // Do estado misto, o "marcar todos" marca tudo; só então desmarca tudo.
    await caixa(dialogo, 'Marcar todos os itens').click();
    await expect(dialogo.getByRole('button', { name: 'Enviar 2 itens' })).toBeEnabled();
    await caixa(dialogo, 'Marcar todos os itens').click();
    await expect(dialogo.getByRole('button', { name: 'Enviar 0 itens' })).toBeDisabled();
    await caixa(dialogo, 'Marcar todos os itens').click();
    await expect(dialogo.getByRole('button', { name: 'Enviar 2 itens' })).toBeEnabled();
    await expect(dialogo).not.toContainText('LAUDO_MEDICO');
    await expect(dialogo).not.toContainText('aprova ou nega');
    await expect(dialogo).toContainText('Os itens marcados vão para a proteção de dados');
    const tabela = dialogo.locator('.table-responsive');
    const rola = await tabela.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(rola).toBe(false);
    const largura = await dialogo
      .locator('.uni-dialog__panel')
      .evaluate((el) => Math.round(el.getBoundingClientRect().width));
    testInfo.annotations.push({ type: 'largura-do-dialogo', description: String(largura) });
    expect(largura).toBeLessThanOrEqual(page.viewportSize()?.width ?? Infinity);
    await page.screenshot({ path: testInfo.outputPath('solicitacao-dialogo.png') });
  });
});
