import type { Page } from '@playwright/test';

/**
 * Faz a requisição à API que o cenário não simulou falhar como se a API estivesse fora do ar, que
 * é como o CI roda a matriz. Registre antes das simulações do cenário: a rota registrada depois
 * vence. Sem isso, com a API no ar, a pessoa autenticada responde 403 ao catálogo que o cenário
 * não simulou e a tela vai para "Acesso negado".
 */
export async function isolarDaApi(page: Page): Promise<void> {
  await page.route('**/api/**', (route) => route.abort('connectionrefused'));
}
