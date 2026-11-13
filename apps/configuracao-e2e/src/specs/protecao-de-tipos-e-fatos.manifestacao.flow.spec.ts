import { expect, test, type Locator, type Page } from '@playwright/test';
import { mockPermissoesEfetivas, runAxeWcagAA } from '@uniplus/shared-e2e';
import { MANIFESTACAO_DESFAVORAVEL, mockManifestacoes } from '../support/api-da-manifestacao';
import { PENDENCIAS } from '../support/dados-de-tipos-e-fatos';
import {
  PERMISSOES_DA_BETINA_DECIDE_A_PROTECAO,
  PERMISSOES_DA_ISABELLA_MANIFESTA,
} from '../support/permissoes';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const ITEM = PENDENCIAS[0];

async function abrirItem(page: Page, permissoes: readonly string[]): Promise<void> {
  await mockConfiguracaoRuntimeConfig(page);
  await mockPermissoesEfetivas(page, permissoes);
  await page.goto('/protecao-do-catalogo');
  await page.getByRole('button', { name: `Ver o detalhe de ${ITEM.nome}`, exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Detalhe do item aguardando a decisão' }),
  ).toBeVisible();
}

/** Escolhe o parecer pelo nome exato do rádio: "Adequada" não pode casar com "Inadequada". */
async function escolherParecer(drawer: Locator, parecer: string): Promise<void> {
  await drawer
    .locator('label.radio')
    .filter({ has: drawer.page().getByRole('radio', { name: parecer, exact: true }) })
    .click();
}

async function semViolacoes(page: Page): Promise<void> {
  const { violations } = await runAxeWcagAA(page);
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
}

test.describe('Proteção dos tipos de documento e dos fatos — manifestação técnica', () => {
  test('o Encarregado de dados registra o parecer desfavorável com texto, sem ver as ações de decidir', async ({
    page,
  }) => {
    const escritas = await mockManifestacoes(page, []);
    await abrirItem(page, PERMISSOES_DA_ISABELLA_MANIFESTA);
    const drawer = page.getByRole('dialog', { name: 'Detalhe do item aguardando a decisão' });

    await expect(drawer.getByRole('button', { name: 'Aprovar' })).toHaveCount(0);
    await escolherParecer(drawer, 'Inadequada');
    await drawer.getByRole('button', { name: 'Registrar manifestação' }).click();
    await expect(
      drawer.getByText('Os pareceres recomenda ajuste e inadequada exigem o texto.'),
    ).toBeVisible();
    expect(escritas).toHaveLength(0);

    await drawer.getByRole('textbox', { name: 'Texto' }).fill('A classificação deve ser sensível.');
    await drawer.getByRole('button', { name: 'Registrar manifestação' }).click();
    await expect.poll(() => escritas.length).toBe(1);
    expect(escritas[0]).toMatchObject({
      metodo: 'POST',
      corpo: { cadastro: 'TIPO_DOCUMENTO', itemId: ITEM.id, ciclo: 1, parecer: 'INADEQUADA' },
    });
    expect(escritas[0]?.chave).toBeTruthy();
    await semViolacoes(page);
  });

  test('o ciclo mudado (409) avisa e não reenvia sozinho', async ({ page }) => {
    const escritas = await mockManifestacoes(page, [], {
      status: 409,
      corpo: {
        status: 409,
        code: 'uniplus.configuracao.protecao_do_catalogo.ciclo_mudou',
        title: 'O ciclo de aprovação do item mudou depois de lido; releia o item',
      },
    });
    await abrirItem(page, PERMISSOES_DA_ISABELLA_MANIFESTA);
    const drawer = page.getByRole('dialog', { name: 'Detalhe do item aguardando a decisão' });

    await escolherParecer(drawer, 'Adequada');
    await drawer.getByRole('button', { name: 'Registrar manifestação' }).click();

    await expect(drawer.getByText('O item foi relido')).toBeVisible();
    expect(escritas).toHaveLength(1);
  });

  test('o Representante do controlador aprova diante de manifestação desfavorável só com justificativa', async ({
    page,
  }) => {
    const escritas = await mockManifestacoes(page, [MANIFESTACAO_DESFAVORAVEL]);
    await abrirItem(page, PERMISSOES_DA_BETINA_DECIDE_A_PROTECAO);
    await page
      .getByRole('dialog', { name: 'Detalhe do item aguardando a decisão' })
      .getByRole('button', { name: 'Aprovar' })
      .click();
    const dialogo = page.getByRole('dialog', { name: 'Aprovar a proteção de dados do item' });

    await expect(dialogo.getByText('Inadequada')).toBeVisible();
    await dialogo.getByRole('button', { name: 'Aprovar item' }).click();
    await expect(
      dialogo.getByText(
        'Há manifestação desfavorável vigente: informe a justificativa da decisão.',
      ),
    ).toBeVisible();
    await semViolacoes(page);

    await dialogo
      .getByRole('textbox', { name: 'Justificativa' })
      .fill('A classificação interna basta.');
    await dialogo.getByRole('button', { name: 'Aprovar item' }).click();
    await expect.poll(() => escritas.length).toBe(1);
    expect(escritas[0]?.corpo).toMatchObject({
      decisao: 'APROVAR',
      justificativa: 'A classificação interna basta.',
    });
  });

  for (const [nome, largura, altura] of [
    ['320 px', 320, 700],
    ['zoom de 200% (1366 px a 200%)', 683, 384],
  ] as const) {
    test(`o formulário da manifestação cabe sem rolagem horizontal em ${nome}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: largura, height: altura });
      await mockManifestacoes(page, [MANIFESTACAO_DESFAVORAVEL]);
      await abrirItem(page, PERMISSOES_DA_ISABELLA_MANIFESTA);
      const corpo = page.locator('.uni-drawer__body');
      const rola = await corpo.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(rola, 'o drawer não rola na horizontal').toBe(false);
    });
  }
});
