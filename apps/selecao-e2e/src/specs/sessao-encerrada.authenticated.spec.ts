import { expect, test, type Page } from '@playwright/test';
import { mockPermissoesEfetivas } from '@uniplus/shared-e2e';
import { PERMISSOES_DO_LEANDRO } from '../support/permissoes';

/**
 * Quando o servidor recusa um pedido por falta de sessão, a pessoa vê o aviso de que a sessão
 * acabou e de que o que não foi gravado se perdeu, e só vai ao login se pedir, voltando à mesma
 * rota. Nada fica guardado no navegador, nem o preenchido nem a credencial.
 */

const ROTA = '/processo-seletivo/novo';

/**
 * O cliente de login grava no navegador só o estado do retorno do login, sem credencial. O que
 * se confere é que nenhum valor guardado parece um token (o JWT começa com `eyJ`) e que nenhuma
 * chave fala de token.
 */
async function credenciaisNoArmazenamento(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [localStorage, sessionStorage].flatMap((armazenamento) =>
      Object.entries(armazenamento)
        .filter(([chave, valor]) => /token/i.test(chave) || valor.includes('eyJ'))
        .map(([chave]) => chave),
    ),
  );
}

test.describe('Sessão encerrada', () => {
  test.beforeEach(async ({ page }) => {
    await mockPermissoesEfetivas(page, PERMISSOES_DO_LEANDRO);
    await page.route('**/api/**', (rota) =>
      rota.request().method() === 'OPTIONS'
        ? rota.fulfill({
            status: 204,
            headers: {
              'access-control-allow-origin': '*',
              'access-control-allow-headers': '*',
              'access-control-allow-methods': '*',
            },
          })
        : rota.fulfill({
            status: 401,
            contentType: 'application/problem+json',
            headers: { 'access-control-allow-origin': '*' },
            body: JSON.stringify({ title: 'Não autenticado', status: 401 }),
          }),
    );
  });

  test('avisa, leva o foco ao botão de entrar e volta à mesma rota ao entrar novamente', async ({
    page,
  }) => {
    await page.goto(ROTA);

    const aviso = page.getByRole('dialog', { name: 'Sua sessão foi encerrada' });
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText('O que você preencheu e ainda não gravou se perdeu.');
    await expect(aviso.getByRole('button', { name: 'Entrar novamente' })).toBeFocused();
    expect(await credenciaisNoArmazenamento(page)).toEqual([]);

    const rotaAberta = page.url();
    const login = page.waitForRequest((pedido) =>
      pedido.url().includes('/protocol/openid-connect/auth'),
    );
    await aviso.getByRole('button', { name: 'Entrar novamente' }).click();

    const destino = new URL((await login).url());
    expect(destino.searchParams.get('redirect_uri')).toBe(rotaAberta);
  });

  test('"Agora não" fecha o aviso e devolve a tela à pessoa', async ({ page }) => {
    await page.goto(ROTA);
    const aviso = page.getByRole('dialog', { name: 'Sua sessão foi encerrada' });

    await aviso.getByRole('button', { name: 'Agora não' }).click();

    await expect(aviso).toBeHidden();
  });
});
