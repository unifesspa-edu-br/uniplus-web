import { expect, test, type Page } from '@playwright/test';
import { PROCESSO_PUBLICADO_DA_MEDICINA } from '../fixtures/consulta-da-medicina';
import { mockarFormularioDoProcesso } from '../support/api-do-formulario-do-processo';

/**
 * A pessoa sem permissão para consultar os modelos de formulário continua no passo Formulários:
 * a consulta dos modelos é apoio, e a recusa dela é avisada na própria etapa, sem levar à página
 * de acesso negado nem perder o que já está preenchido.
 */
const CAMPO_DA_PCD = /Você é pessoa com deficiência/;
const AVISO = /Não foi possível carregar os modelos de formulário\./;

async function recusarOsModelosPorFaltaDePermissao(page: Page): Promise<void> {
  await page.route(/\/api\/configuracao\/admin\/modelos-formulario(\?.*)?$/, async (route) => {
    const cabecalhos = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cabecalhos });
      return;
    }
    await route.fulfill({
      status: 403,
      contentType: 'application/problem+json',
      headers: cabecalhos,
      body: JSON.stringify({
        type: 'about:blank',
        title: 'Acesso negado',
        status: 403,
        code: 'uniplus.auth.forbidden',
        traceId: '00000000000000000000000000000001',
      }),
    });
  });
}

async function abrirOPassoFormularios(page: Page): Promise<void> {
  await page.goto(`/processo-seletivo/${PROCESSO_PUBLICADO_DA_MEDICINA.id}`);
  await page
    .getByRole('navigation', { name: 'Etapas do cadastro' })
    .getByRole('button', { name: 'Formulários' })
    .click();
}

test.describe('Formulários — consulta dos modelos recusada por falta de permissão', () => {
  test('o passo avisa o que não carregou e o restante segue', async ({ page }) => {
    await mockarFormularioDoProcesso(page);
    await recusarOsModelosPorFaltaDePermissao(page);

    await abrirOPassoFormularios(page);

    await expect(
      page.getByRole('heading', { level: 1, name: /^Passo \d+: Formulários/ }),
    ).toBeVisible();
    await expect(page.getByText(AVISO)).toBeVisible();
    await expect(page.getByRole('article', { name: CAMPO_DA_PCD })).toBeVisible();
    await expect(page).not.toHaveURL(/acesso-negado/);
  });
});
