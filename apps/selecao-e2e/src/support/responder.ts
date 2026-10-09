import type { Page, Route } from '@playwright/test';

/**
 * Responde à rota com JSON 200 e atende o preflight CORS. O corpo pode ser uma função: ela é lida
 * a cada requisição, para o spec que muda o dado entre uma consulta e outra.
 */
export async function responder(
  page: Page,
  rota: RegExp,
  corpo: unknown,
  cabecalhos: Record<string, string>,
): Promise<void> {
  await page.route(rota, async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cabecalhos });
      return;
    }
    await responderCom(route, typeof corpo === 'function' ? corpo() : corpo, cabecalhos);
  });
}

export async function responderCom(
  route: Route,
  corpo: unknown,
  cabecalhos: Record<string, string>,
): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: cabecalhos,
    body: JSON.stringify(corpo),
  });
}
