import { test, expect } from '@playwright/test';
import { resetPasswords, keycloakLogin, expectUserInHeader } from '@uniplus/shared-e2e';

/**
 * Fecha o ciclo de validação da Feature #444 (uniplus-web#449): login OIDC
 * completo (PKCE), silent check-SSO e logout, todos contra o portal servido
 * sob subpath real (`/portal/`), não a raiz. Cobre exatamente os dois bugs
 * reais achados durante a implantação do HML e corrigidos nesta Feature:
 *
 * - base href não reescrito sob subpath (Story #448) — sem o fix,
 *   `runtime-config.json`/`silent-check-sso.html` 404am, o app nem
 *   inicializa.
 * - logout redirecionando pra raiz do host em vez do subpath (Story #447)
 *   — sem o fix, pós-logout cai no 404 do Traefik (em produção) ou na raiz
 *   errada (aqui, `http://localhost:4212/` em vez de `.../portal/`).
 */
const USER = {
  username: 'candidato',
  password: 'E2eTest!123',
  displayName: 'Candidato Teste',
  roles: ['candidato'],
};

test.describe('Autenticação OIDC sob subpath — Portal (/portal/)', () => {
  test.beforeAll(async () => {
    await resetPasswords([{ username: USER.username, password: USER.password }]);
  });

  // `page.goto('processos')`, não `page.goto('/processos')` — com barra
  // inicial, a resolução de URL descarta o path do baseURL (`/portal/`) e
  // navega pra raiz do host (`new URL('/processos', 'http://host/portal/')`
  // = `http://host/processos`, comportamento padrão de URL absoluta vs.
  // relativa). Mesma pegadinha que o app evita usando `document.baseURI`
  // em vez de paths absolutos (Story #446/#448).

  test('shell carrega sob /portal/ sem autenticação (rota pública)', async ({ page }) => {
    await page.goto('processos');

    // Confirma que o base href real (não a raiz do host) está em vigor —
    // se a Story #448 regredir, os assets 404am e o app não chega a
    // renderizar o heading abaixo.
    await expect(page).toHaveURL(/localhost:4212\/portal\/processos/);
    await expect(page.getByRole('heading', { name: 'Processos Seletivos', level: 1 })).toBeVisible();
  });

  test('login PKCE completo redireciona de volta ao subpath /portal/, não à raiz do host', async ({
    page,
  }) => {
    await page.goto('perfil');
    await page.waitForURL(/realms\/unifesspa\/protocol\/openid-connect/, { timeout: 10_000 });
    await expect(page.locator('#kc-login')).toBeVisible();

    await keycloakLogin(page, USER.username, USER.password, {
      expectRedirectTo: /localhost:4212\/portal\//,
    });

    // Regressão explícita: o Keycloak nunca deveria devolver pra raiz nua
    // do host (sem o segmento /portal/) — cobriria tanto um redirect_uri
    // mal configurado quanto um base href não reescrito.
    await expect(page).not.toHaveURL(/^http:\/\/localhost:4212\/$/);
    await expectUserInHeader(page, USER.displayName, USER.username, USER.roles);
  });

  test('silent check-SSO reconhece a sessão em um novo carregamento, sem exigir login de novo', async ({
    page,
  }) => {
    await page.goto('perfil');
    await keycloakLogin(page, USER.username, USER.password, {
      expectRedirectTo: /localhost:4212\/portal\//,
    });

    // Nova navegação "a frio" — só autentica de novo sem interação se
    // silentCheckSsoRedirectUri (resolvido via document.baseURI, Story
    // #446/#448) apontar pro arquivo real sob /portal/assets/.
    await page.goto('processos');
    await expect(page).toHaveURL(/localhost:4212\/portal\/processos/);
    await expectUserInHeader(page, USER.displayName, USER.username, USER.roles);
  });

  test('logout redireciona ao subpath /portal/, não à raiz do host (Story #447)', async ({
    page,
  }) => {
    await page.goto('perfil');
    await keycloakLogin(page, USER.username, USER.password, {
      expectRedirectTo: /localhost:4212\/portal\//,
    });

    // Captura a navegação real pro endpoint de logout do Keycloak — é ali
    // que o `post_logout_redirect_uri` (o que AuthService.logout() envia
    // como `redirectUri`) fica exposto. Checar só a URL final da página
    // (após o Keycloak devolver o browser) NÃO é suficiente pra fechar
    // #447: o Angular Router, já bootstrapado com `<base href="/portal/">`
    // (Story #448), pode normalizar a URL do browser de volta pro subpath
    // via navegação client-side mesmo que o `redirectUri` enviado ao
    // Keycloak estivesse errado (raiz nua) — mascarando a regressão que
    // este teste existe pra pegar.
    const logoutRequest = page.waitForRequest(
      (req) => req.url().includes('/protocol/openid-connect/logout'),
      { timeout: 10_000 },
    );
    // Espera o round-trip completo (não só o request sair) — sem isso o
    // `page.goto('perfil')` abaixo pode disparar antes do Keycloak
    // terminar de processar o logout e aplicar o redirect, cancelando a
    // navegação em curso e deixando o teste intermitente (achado do Codex
    // AI: `waitForURL` de escopo largo casava com a própria URL
    // pré-logout, retornando cedo demais).
    const logoutResponse = page.waitForResponse(
      (res) => res.url().includes('/protocol/openid-connect/logout'),
      { timeout: 10_000 },
    );

    const trigger = page.getByRole('button', { name: /^Abrir menu da conta de / });
    await trigger.click();
    await page.getByRole('menuitem', { name: 'Sair' }).click();

    const request = await logoutRequest;
    const redirectParam = new URL(request.url()).searchParams.get('post_logout_redirect_uri');

    // A asserção que de fato fecha #447: o parâmetro enviado ao Keycloak
    // precisa conter o segmento /portal/, não a raiz nua do host. Antes do
    // fix (`redirectUri: window.location.origin`), esse parâmetro vinha
    // `http://localhost:4212` sem o subpath — em produção (HML,
    // PathPrefix sem StripPrefix), essa raiz nem tem rota própria e cai
    // no 404 do Traefik.
    expect(redirectParam).toMatch(/localhost:4212\/portal\//);

    await logoutResponse;
    // Sinal inequívoco de navegação real (não a URL pré-logout, que já
    // casaria trivialmente com um regex largo tipo /localhost:4212\//).
    await page.waitForURL((url) => !url.pathname.includes('perfil'), { timeout: 10_000 });

    // Sessão de fato encerrada: rota protegida volta a exigir login.
    await page.goto('perfil');
    await page.waitForURL(/realms\/unifesspa\/protocol\/openid-connect/, { timeout: 10_000 });
    await expect(page.locator('#kc-login')).toBeVisible();
  });
});
