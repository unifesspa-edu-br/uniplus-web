import { expect, test } from '@playwright/test';
import { mockApi } from '../support/api-da-base-legal-bonus-regional';
import {
  busca,
  drawer,
  editar,
  novo,
  titulo,
} from '../support/passos-da-base-legal-bonus-regional';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

test.describe('Base legal de bônus regional — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('a falha da busca de município oferece "Tentar novamente", que devolve o foco à busca', async ({
    page,
  }) => {
    await mockApi(page, [], { recarga: 'com-o-item', buscaFalhaNaPrimeira: true });
    await page.goto('/base-legal-bonus-regional');
    await novo(page).click();
    const formulario = drawer(page);
    await busca(formulario).fill('Marabá');
    const tentar = formulario.getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(formulario.getByRole('button', { name: /Marabá — PA/ })).toBeVisible();
    await expect(busca(formulario)).toBeFocused();
  });

  test('"Tentar novamente" da lista fica focado e indisponível durante a carga e leva o foco ao título', async ({
    page,
  }) => {
    await mockApi(page, [], { recarga: 'com-o-item', listaFalhaNaPrimeira: true });
    await page.goto('/base-legal-bonus-regional');
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(editar(page)).toBeVisible();
    await expect(titulo(page)).toBeFocused();
  });

  test('a falha do vocabulário avisa na página e a nova tentativa leva o foco ao título', async ({
    page,
  }) => {
    await mockApi(page, [], { recarga: 'com-o-item', falhasDoVocabulario: 1 });
    await page.goto('/base-legal-bonus-regional');
    const aviso = page.locator('ui-alerta-nova-tentativa');
    await expect(aviso).toContainText('Tipos de instrumento não carregados');
    const tentar = aviso.getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(aviso).toBeHidden();
    await expect(titulo(page)).toBeFocused();
  });

  test('a falha do vocabulário no formulário oferece "Tentar novamente", que leva o foco ao tipo', async ({
    page,
  }) => {
    await mockApi(page, [], { recarga: 'com-o-item', falhasDoVocabulario: 2 });
    await page.goto('/base-legal-bonus-regional');
    await novo(page).click();
    const formulario = drawer(page);
    const aviso = formulario.locator('ui-alerta-nova-tentativa');
    await expect(aviso).toContainText('sem o vocabulário de tipos');
    await expect(formulario.locator('select[formcontrolname="tipoInstrumento"]')).toHaveAttribute(
      'aria-describedby',
      'cfg-blbr-tipos-falha',
    );
    const tentar = aviso.getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();
    await expect(aviso).toBeHidden();
    await expect(formulario.locator('select[formcontrolname="tipoInstrumento"]')).toBeFocused();
  });
});
