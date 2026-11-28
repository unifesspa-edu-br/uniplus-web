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
 * Contra o provedor de login real: no fim do período máximo, "Entrar de novo agora" encerra a
 * sessão e começa outra, com fim de período novo. Pedir nova autenticação com a sessão viva
 * manteria a mesma sessão. O cliente de login do teste tem período máximo de 300 s; o realm
 * compartilhado não muda. A regra reconhece o período máximo quando o vencimento da credencial
 * chega a 120 s do fim, então o período precisa ser bem maior que a margem para o teste
 * distinguir os dois limites; a página só é recarregada 260 s depois da autenticação, quando
 * restam menos de 120 s, para provar que o aviso reconhece o período máximo sem renovar.
 */
const APP = process.env['BASE_URL'] ?? 'http://localhost:4200';
const ROTA = '/dashboard';
const PERIODO_MAXIMO_EM_SEGUNDOS = 300;
const RECARGA_APOS_A_AUTENTICACAO_EM_SEGUNDOS = 260;
const ACESSO_EM_SEGUNDOS = 20;
const MARGEM_DA_REGRA_EM_SEGUNDOS = 120;
const FOLGA_DO_VENCIMENTO_EM_SEGUNDOS = 10;
const AVISO = 'Sua sessão está perto de acabar';

test.describe('Entrar de novo no fim do período máximo, com o provedor de login real', () => {
  let cliente: ClienteDeSessaoCurta;

  test.beforeAll(async () => {
    cliente = await criarClienteDeSessaoCurta(APP, {
      acessoEmSegundos: ACESSO_EM_SEGUNDOS,
      ociosidadeEmSegundos: 1800,
      periodoMaximoEmSegundos: PERIODO_MAXIMO_EM_SEGUNDOS,
    });
  });
  test.afterAll(async () => cliente?.remover());

  test('começa uma sessão nova, com fim de período novo, e volta à mesma rota', async ({
    browser,
  }) => {
    test.setTimeout(420_000);
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
    const { sessoes, renovacoes } = acompanharTokens(page);
    await page.goto(ROTA);
    await keycloakLogin(page, GESTOR_DE_ACESSOS, SENHA_DAS_PERSONAS, {
      expectRedirectTo: new RegExp(APP.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    });

    const aviso = page.getByRole('dialog', { name: AVISO });
    const continuar = aviso.getByRole('button', { name: 'Continuar' });
    const entrarDeNovo = aviso.getByRole('button', { name: 'Entrar de novo agora' });
    await expect(entrarDeNovo).toBeVisible({ timeout: 240_000 });
    const renovacoesAoAbrir = renovacoes();
    const { autenticadoEm, fimDoPeriodo } = sessoes[0];
    expect(fimDoPeriodo).toBeGreaterThanOrEqual(
      autenticadoEm + PERIODO_MAXIMO_EM_SEGUNDOS - MARGEM_DA_REGRA_EM_SEGUNDOS,
    );
    expect(fimDoPeriodo).toBeLessThanOrEqual(
      autenticadoEm + PERIODO_MAXIMO_EM_SEGUNDOS + FOLGA_DO_VENCIMENTO_EM_SEGUNDOS,
    );

    const recarregarEm = (autenticadoEm + RECARGA_APOS_A_AUTENTICACAO_EM_SEGUNDOS) * 1000;
    await page.waitForTimeout(Math.max(0, recarregarEm - Date.now()));
    await page.reload();
    await expect(entrarDeNovo).toBeVisible({ timeout: 30_000 });
    await expect(continuar).toBeHidden();
    await expect(aviso).toContainText('encerra a sessão em todas as páginas do Uni+');
    const antes = sessoes[sessoes.length - 1];

    expect(renovacoes()).toBe(renovacoesAoAbrir);
    await entrarDeNovo.click();
    await keycloakLogin(page, GESTOR_DE_ACESSOS, SENHA_DAS_PERSONAS, {
      expectRedirectTo: new RegExp(APP.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    });

    await expect
      .poll(() => sessoes[sessoes.length - 1].sid, { timeout: 15_000 })
      .not.toBe(antes.sid);
    const depois = sessoes[sessoes.length - 1];
    expect(depois.fimDoPeriodo).toBeGreaterThan(antes.fimDoPeriodo);
    const destino = new URL(page.url());
    expect(destino.pathname).toBe(ROTA);
    expect(destino.searchParams.has('entrarDeNovo')).toBe(false);
    await expect(page.getByRole('dialog', { name: 'Sua sessão foi encerrada' })).toBeHidden();
    await contexto.close();
  });
});
