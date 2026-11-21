import { expect, test, type Page } from '@playwright/test';
import { formularioDoSimulador } from '../support/formulario-do-simulador';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

/**
 * O arquivo do simulador cuja condição traz um operador que o contrato não conhece, ou nenhum, é
 * recusado na leitura, com o caminho da condição: a tela não desenha um formulário cujas regras o
 * interpretador não saberia avaliar.
 *
 * O arquivo é aberto no navegador e a simulação não chama a API: nada aqui depende do backend. O
 * operador fora do vocabulário é escrito por extenso, porque o tipo gerado não o admitiria.
 */
function formularioComCondicao(condicao: Record<string, unknown>) {
  return formularioDoSimulador(condicao);
}

async function importar(page: Page, formulario: unknown): Promise<void> {
  await page.goto('/simulador-de-formulario');
  await expect(
    page.getByRole('heading', { name: 'Simulador de formulário', level: 1 }),
  ).toBeVisible();
  await page.getByLabel('Arquivo JSON do formulário').setInputFiles({
    name: 'formulario.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(formulario)),
  });
}

test.describe('Simulador de formulário — operador da condição', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('o operador fora do vocabulário recusa o arquivo e aponta a condição', async ({ page }) => {
    await importar(
      page,
      formularioComCondicao({ fato: 'TIPO_ENDERECO', operador: 'PARECIDO', valor: 'ALDEIA' }),
    );

    const erro = page.locator('#simulador-arquivo-erro');
    await expect(erro).toContainText('O operador da condição não é reconhecido.');
    await expect(erro).toContainText(/\(em regras\..*exibicao.*\.operador\)/);
    await expect(page.getByRole('heading', { name: /Endereço/, level: 3 })).toHaveCount(0);
  });

  test('a condição sem operador também recusa o arquivo', async ({ page }) => {
    await importar(page, formularioComCondicao({ fato: 'TIPO_ENDERECO', valor: 'ALDEIA' }));

    await expect(page.locator('#simulador-arquivo-erro')).toContainText(
      'O operador da condição não é reconhecido.',
    );
  });

  test('o operador do vocabulário carrega o formulário', async ({ page }) => {
    await importar(
      page,
      formularioComCondicao({ fato: 'TIPO_ENDERECO', operador: 'IGUAL', valor: 'ALDEIA' }),
    );

    await expect(page.getByRole('heading', { name: /Endereço/, level: 3 })).toBeVisible();
    await expect(page.locator('#simulador-arquivo-erro')).toHaveCount(0);
  });
});
