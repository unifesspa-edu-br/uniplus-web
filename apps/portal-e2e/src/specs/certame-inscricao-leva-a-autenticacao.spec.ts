import type { CertameNaVitrineDto, SituacaoDoCertame } from '@uniplus/shared-data/selecao';
import { test, expect, type Page } from '@playwright/test';

/**
 * O caminho do botão de inscrição até a tela de entrar na conta (issue #785), simulado na rede —
 * sem exigir Keycloak nem a API reais. A vitrine serve um único certame aberto; "Inscrever-me"
 * aciona o `authGuard` de `/inscricao/:id`, que redireciona ao provedor OIDC.
 */
const API_URL = 'http://localhost:5000';
const ISSUER_URL = 'http://localhost:8080/realms/unifesspa';
const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, accept',
};

const CERTAME: CertameNaVitrineDto = {
  processoSeletivoId: '01960000-0000-7000-0000-000000000098',
  identificadorLegivel: 'PS-2026-098',
  numero: '021/2026',
  nome: 'Processo Seletivo Simulado — Caminho até o Login',
  tipoProcesso: { codigo: 'PSE', nome: 'Processo Seletivo Especial' },
  modalidadesOfertadas: ['AC'],
  inscricoesDe: '2026-01-01T12:00:00Z',
  inscricoesAte: '2026-12-05T23:59:00Z',
  situacao: 'inscricoesAbertas' as SituacaoDoCertame,
  totalDeVagas: 10,
};

test.describe('Caminho até a autenticação a partir da página do certame', () => {
  test('botão de inscrição leva à tela de entrar na conta', async ({ page }) => {
    await mockCertameAberto(page);

    await page.goto('/processos');
    await expect(page.getByRole('heading', { name: 'Processos seletivos', level: 1 })).toBeVisible();
    await expect(page.locator('.certames-loading')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: CERTAME.nome, level: 3 })).toBeVisible();

    await page.getByRole('link', { name: /^Inscrever-me/ }).first().click();

    await page.waitForURL(new RegExp(`${escapeRegExp(ISSUER_URL)}/protocol/openid-connect`));
    await expect(page.getByText('Entrar na conta Unifesspa')).toBeVisible();
  });
});

function escapeRegExp(valor: string): string {
  return valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Simula o `runtime-config.json`, a vitrine com um único certame aberto, a página pública dele
 * (sem atos, irrelevante aqui) e o provedor OIDC. A checagem silenciosa de sessão
 * (`check-sso`, iframe oculto com `prompt=none`) diz que não há sessão; o login explícito
 * (clique em "Inscrever-me", sem `prompt=none`) serve a tela de entrar na conta.
 */
async function mockCertameAberto(page: Page): Promise<void> {
  await page.route(/\/assets\/runtime-config\.json(\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        apiUrl: API_URL,
        oidc: { issuerUrl: ISSUER_URL, clientId: 'portal-web' },
      }),
    }),
  );

  await page.route(`${ISSUER_URL}/protocol/openid-connect/3p-cookies/step1.html`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<script>parent.postMessage("supported", "*");</script>',
    }),
  );

  await page.route(`${ISSUER_URL}/protocol/openid-connect/auth?*`, (route) => {
    const url = new URL(route.request().url());
    const retorno = url.searchParams.get('redirect_uri') ?? '';
    const estado = url.searchParams.get('state') ?? '';

    // `check-sso` (iframe oculto, init da app) pede `prompt=none`: sem sessão, o provedor volta
    // direto ao `redirect_uri` com `login_required`, sem servir tela nenhuma.
    if (url.searchParams.get('prompt') === 'none') {
      return route.fulfill({
        status: 302,
        headers: { location: `${retorno}#error=login_required&state=${estado}` },
      });
    }

    // Login explícito (clique em "Inscrever-me", navegação de topo): a tela de entrar na conta.
    return route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!DOCTYPE html><html><body><h1>Entrar na conta Unifesspa</h1></body></html>',
    });
  });

  await page.route(/\/api\/selecao\/certames(\?.*)?$/, (route) => {
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: CORS_HEADERS });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/vnd.uniplus.certame.v1+json',
      headers: CORS_HEADERS,
      body: JSON.stringify([CERTAME]),
    });
  });

  await page.route(/\/api\/portal\/certames\/[^/?]+(\?.*)?$/, (route) => {
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: CORS_HEADERS });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/vnd.uniplus.certame-publico.v1+json',
      headers: CORS_HEADERS,
      body: JSON.stringify({
        identificador: CERTAME.identificadorLegivel,
        nome: CERTAME.nome,
        numeroEdital: CERTAME.numero,
        documentoEditalUrl: null,
        dataPublicacao: null,
        linhaDoTempo: [],
        aviso: null,
      }),
    });
  });
}
