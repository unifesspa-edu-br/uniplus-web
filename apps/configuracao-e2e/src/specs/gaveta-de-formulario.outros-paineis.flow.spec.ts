import { expect, test, type Locator, type Page } from '@playwright/test';
import { mockInstituicaoApi, mockReitoriasApi } from '../support/api-da-instituicao';
import { mockUnidadesApi } from '../support/api-das-unidades';
import {
  andarPorTabAteAAcao,
  conferirQueSoOCorpoRola,
  rolarOCorpoAteOFim,
} from '../support/gaveta-de-formulario';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const TELAS = [
  { largura: 320, altura: 568 },
  { largura: 640, altura: 360 },
] as const;

/** Painel de edição cujo rodapé tem três ações e quebra em linhas no celular. */
async function abrirEdicaoDaInstituicao(page: Page): Promise<Locator> {
  await mockReitoriasApi(page);
  await mockInstituicaoApi(page, { existe: true });
  await page.goto('/instituicao');
  await page.getByRole('button', { name: 'Editar' }).click();
  const painel = page.locator('dialog.uni-drawer').filter({ hasText: 'Editar instituição' });
  await expect(painel).toBeVisible();
  return painel;
}

/** Painel só de leitura: a região da ficha recebe o foco e rola com as setas. */
async function abrirDetalheDaUnidade(page: Page): Promise<Locator> {
  await mockUnidadesApi(page);
  await page.goto('/unidades');
  await page.locator('.unit-node__name').first().click();
  const painel = page.locator('dialog.uni-drawer').filter({ hasText: 'Detalhes da unidade' });
  await expect(painel).toBeVisible();
  return painel;
}

for (const tela of TELAS) {
  test.describe(`Outros painéis de gaveta em ${tela.largura}x${tela.altura}`, () => {
    test.beforeEach(async ({ page }) => {
      await mockConfiguracaoRuntimeConfig(page);
      await page.setViewportSize({ width: tela.largura, height: tela.altura });
    });

    test('edição da instituição: só o corpo rola e as três ações ficam utilizáveis', async ({
      page,
    }) => {
      const painel = await abrirEdicaoDaInstituicao(page);
      await conferirQueSoOCorpoRola(painel);
      for (const nome of ['Remover', 'Cancelar', 'Salvar instituição']) {
        await expect(painel.getByRole('button', { name: nome })).toBeInViewport();
      }
    });

    test('edição da instituição: por Tab, nenhum campo focado fica sob o rodapé', async ({
      page,
    }) => {
      const painel = await abrirEdicaoDaInstituicao(page);
      await painel.locator('input').first().focus();
      await andarPorTabAteAAcao(page, painel, 'Salvar instituição');
      await expect(painel.getByRole('button', { name: 'Salvar instituição' })).toBeFocused();
    });

    test('detalhe da unidade: o conteúdo inteiro é alcançável por rolagem', async ({ page }) => {
      const painel = await abrirDetalheDaUnidade(page);
      await expect(painel.getByRole('heading', { name: 'Detalhes da unidade' })).toBeInViewport();
      await rolarOCorpoAteOFim(painel);
      await expect(painel.locator('.cfg-detail-list dd').last()).toBeInViewport();
    });
  });
}
