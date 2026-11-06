import { expect, test, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept',
};

const CAMPUS = {
  id: '01960000-0000-7000-0000-0000000000b1',
  sigla: 'MARABA',
  nome: 'Campus de Marabá',
  codigoEmec: '12345',
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

const ERRO_INTERNO = {
  type: 'about:blank',
  title: 'Erro interno',
  status: 500,
  code: 'uniplus.internal.unexpected',
};

const ATRASO_DA_NOVA_TENTATIVA_EM_MS = 800;

/** A primeira leitura da lista falha; a segunda demora e falha de novo, ou dá certo. */
async function simularLeituras(page: Page, segunda: 'falha' | 'sucesso'): Promise<void> {
  let consultas = 0;
  await page.route(/\/api\/configuracao\/campi(\?.*)?$/, async (route: Route) => {
    consultas += 1;
    if (consultas > 1) {
      await new Promise((resolve) => setTimeout(resolve, ATRASO_DA_NOVA_TENTATIVA_EM_MS));
    }
    const falha = consultas === 1 || segunda === 'falha';
    await route.fulfill({
      status: falha ? 500 : 200,
      headers: CORS_HEADERS,
      contentType: falha ? 'application/problem+json' : 'application/json',
      body: JSON.stringify(falha ? ERRO_INTERNO : [CAMPUS]),
    });
  });
}

test.describe('Nova tentativa de leitura — região de situação', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('a região de status já está na árvore de acessibilidade, vazia, antes do clique', async ({
    page,
  }) => {
    await simularLeituras(page, 'falha');
    await page.goto('/campi');
    const alerta = page.locator('ui-alerta-nova-tentativa');
    const situacao = alerta.getByRole('status');

    await expect(alerta.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
    await expect(situacao).toHaveCount(1);
    await expect(situacao).toBeEmpty();
    expect(await situacao.evaluate((no) => getComputedStyle(no).display)).not.toBe('none');
  });

  test('o primeiro clique mostra "Tentando novamente…" na mesma região, e a falha repetida troca o texto', async ({
    page,
  }) => {
    await simularLeituras(page, 'falha');
    await page.goto('/campi');
    const alerta = page.locator('ui-alerta-nova-tentativa');
    const situacao = alerta.getByRole('status');
    const regiao = await situacao.elementHandle();

    await alerta.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(situacao).toHaveText('Tentando novamente…');
    await expect(situacao).toHaveText('A nova tentativa também falhou.');
    expect(await regiao?.evaluate((no) => no.isConnected)).toBe(true);
  });
});
