import { expect, test } from '@playwright/test';
import {
  acompanharTokens,
  criarClienteDeSessaoCurta,
  GESTOR_DE_ACESSOS,
  keycloakLogin,
  SENHA_DAS_PERSONAS,
  type ClienteDeSessaoCurta,
} from '@uniplus/shared-e2e';

/**
 * Contra o provedor de login real: com a aba parada, a sessão acaba no prazo de ociosidade, sem a
 * pessoa voltar a agir. O cliente de login do teste tem prazos curtos (acesso de 20 s, ociosidade
 * de 45 s, período máximo de 300 s), para o fim chegar em segundos reais; o realm compartilhado não
 * muda. Recarregada cedo, a página reconhece a inatividade: o vencimento fica bem antes de 120 s do
 * fim do período máximo, e o aviso oferece "Continuar".
 */
const APP = process.env['BASE_URL'] ?? 'http://localhost:4200';
const ACESSO_EM_SEGUNDOS = 20;
const OCIOSIDADE_EM_SEGUNDOS = 45;
const PERIODO_MAXIMO_EM_SEGUNDOS = 300;
const MARGEM_DA_REGRA_EM_SEGUNDOS = 120;
const AVISO = 'Sua sessão está perto de acabar';
const ENCERRADA = 'Sua sessão foi encerrada';

test.describe('Sessão parada, com o provedor de login real', () => {
  let cliente: ClienteDeSessaoCurta;

  test.beforeAll(async () => {
    cliente = await criarClienteDeSessaoCurta(APP, {
      acessoEmSegundos: ACESSO_EM_SEGUNDOS,
      ociosidadeEmSegundos: OCIOSIDADE_EM_SEGUNDOS,
      periodoMaximoEmSegundos: PERIODO_MAXIMO_EM_SEGUNDOS,
    });
  });
  test.afterAll(async () => cliente?.remover());

  test('avisa logo, não renova sem ação da pessoa e encerra no prazo de ociosidade', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const contexto = await browser.newContext({
      baseURL: APP,
      storageState: { cookies: [], origins: [] },
    });
    const page = await contexto.newPage();
    await page.route('**/assets/runtime-config.json', async (rota) => {
      const resposta = await rota.fetch();
      const config = await resposta.json();
      config.oidc.clientId = cliente.clientId;
      config.oidc.periodoMaximoDaSessaoEmSegundos = PERIODO_MAXIMO_EM_SEGUNDOS;
      await rota.fulfill({ response: resposta, json: config });
    });
    const { sessoes } = acompanharTokens(page);
    await page.goto('/dashboard');
    await keycloakLogin(page, GESTOR_DE_ACESSOS, SENHA_DAS_PERSONAS, {
      expectRedirectTo: new RegExp(APP.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    });

    const aviso = page.getByRole('dialog', { name: AVISO });
    const continuar = aviso.getByRole('button', { name: 'Continuar' });
    await expect(aviso).toBeVisible({ timeout: 15_000 });
    await expect(continuar).toBeVisible();

    await page.reload();
    await expect(aviso).toBeVisible({ timeout: 15_000 });
    await expect(continuar).toBeVisible();
    const { autenticadoEm, fimDoPeriodo } = sessoes[sessoes.length - 1];
    expect(fimDoPeriodo).toBeLessThan(
      autenticadoEm + PERIODO_MAXIMO_EM_SEGUNDOS - MARGEM_DA_REGRA_EM_SEGUNDOS,
    );

    const renovacoesAceitas: string[] = [];
    page.on('response', (resposta) => {
      if (resposta.url().includes('/protocol/openid-connect/token') && resposta.ok()) {
        renovacoesAceitas.push(resposta.url());
      }
    });

    await page.waitForTimeout(25_000);
    await expect(page.getByRole('dialog', { name: ENCERRADA })).toBeHidden();

    await expect(page.getByRole('dialog', { name: ENCERRADA })).toBeVisible({ timeout: 40_000 });
    await expect(page.getByRole('dialog', { name: AVISO })).toBeHidden();
    expect(renovacoesAceitas).toEqual([]);
    await contexto.close();
  });
});
