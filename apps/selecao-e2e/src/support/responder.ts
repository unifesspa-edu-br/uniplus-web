import type { Page, Route } from '@playwright/test';

export interface Options {
  headers?: { [p: string]: string } | undefined;
}

export async function responder(page: Page, rota: RegExp, corpo: unknown, opcoes: Options): Promise<void> {
  await page.route(rota, async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: opcoes.headers });
      return;
    }
    await responderCom(route, corpo, opcoes);
  });
}

export async function responderCom(route: Route, corpo: unknown, opcoes: Options): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: opcoes.headers,
    body: JSON.stringify(corpo),
  });
}
