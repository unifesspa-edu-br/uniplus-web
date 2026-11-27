import { expect, test, type Page } from '@playwright/test';
import {
  criarClienteDeSessaoCurta,
  GESTOR_DE_ACESSOS,
  keycloakLogin,
  SENHA_DAS_PERSONAS,
  type ClienteDeSessaoCurta,
} from '@uniplus/shared-e2e';

/**
 * Contra o provedor de login real: no fim do período máximo, "Entrar de novo agora" encerra a
 * sessão e começa outra, com fim de período novo. Pedir nova autenticação com a sessão viva
 * manteria a mesma sessão. O cliente de login do teste tem período máximo curto; o realm
 * compartilhado não muda.
 */
const APP = process.env['BASE_URL'] ?? 'http://localhost:4200';
const ROTA = '/dashboard';
const PERIODO_MAXIMO_EM_SEGUNDOS = 100;
const ACESSO_EM_SEGUNDOS = 20;
const AVISO = 'Sua sessão está perto de acabar';

interface Sessao {
  readonly sid: string;
  readonly fimDoPeriodo: number;
}

/** Guarda a sessão de cada resposta do endpoint de token: o `sid` do acesso e o fim da renovação. */
function acompanharSessoes(page: Page): Sessao[] {
  const sessoes: Sessao[] = [];
  page.on('response', async (resposta) => {
    if (!resposta.url().includes('/protocol/openid-connect/token') || !resposta.ok()) return;
    const corpo = await resposta.json().catch(() => null);
    if (!corpo?.access_token || !corpo?.refresh_token) return;
    sessoes.push({
      sid: payloadDe(corpo.access_token)['sid'] as string,
      fimDoPeriodo: payloadDe(corpo.refresh_token)['exp'] as number,
    });
  });
  return sessoes;
}

function payloadDe(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
}

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
      await rota.fulfill({ response: resposta, json: config });
    });
    const sessoes = acompanharSessoes(page);
    await page.goto(ROTA);
    await keycloakLogin(page, GESTOR_DE_ACESSOS, SENHA_DAS_PERSONAS, {
      expectRedirectTo: new RegExp(APP.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    });

    const aviso = page.getByRole('dialog', { name: AVISO });
    // O período máximo não se estende: pedir mais tempo não avança o prazo, e resta entrar de novo.
    await aviso.getByRole('button', { name: 'Continuar' }).click();
    const entrarDeNovo = aviso.getByRole('button', { name: 'Entrar de novo agora' });
    await expect(entrarDeNovo).toBeVisible({ timeout: 30_000 });
    await expect(aviso).toContainText('encerra a sessão em todas as páginas do Uni+');
    const antes = sessoes[sessoes.length - 1];

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
