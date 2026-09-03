import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';
import { runAxeWcagAA } from '@uniplus/shared-e2e';

type VisualTheme = 'light' | 'dark' | 'contrast';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

/**
 * Dois datasets para cobrir os dois estados das ações de linha: no vigente as
 * ações de vigência e remoção ficam desabilitadas, no não vigente ficam
 * ativas. Versões distintas porque o nome acessível das ações é derivado da
 * versão do dataset — linhas com a mesma versão não seriam distinguíveis.
 */
const CALENDARIOS = [
  {
    id: '019ff7ee-3c00-7976-860c-eb2f61c9b2d1',
    versaoDataset: '2026.1',
    vigente: true,
    criadoEm: '2026-08-13T12:00:00Z',
  },
  {
    id: '019ff7ee-3c00-7976-860c-eb2f61c9b2d2',
    versaoDataset: '2025.2',
    vigente: false,
    criadoEm: '2025-11-04T12:00:00Z',
  },
] as const;

test.describe('Calendário de dias úteis — Lista', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const theme = metadataTheme(testInfo);
    await mockConfiguracaoRuntimeConfig(page);
    await page.addInitScript((dsTheme: VisualTheme) => {
      window.localStorage.setItem(
        'uniplus.a11y',
        JSON.stringify({
          theme: dsTheme === 'contrast' ? 'auto' : dsTheme,
          contrast: dsTheme === 'contrast',
          fontMode: 'default',
        }),
      );
    }, theme);
    await mockCalendariosApi(page);
  });

  test('aplica o tema selecionado e lista os datasets cadastrados', async ({ page }, testInfo) => {
    await page.goto('/calendario-dias-uteis');

    await expect(page.locator('html')).toHaveAttribute('data-theme', metadataTheme(testInfo));
    await expect(page.getByRole('heading', { name: 'Calendários', level: 1 })).toBeVisible();
    await expect(page.locator('table tbody tr')).toHaveCount(CALENDARIOS.length);
  });

  test('lista não tem violações serious/critical', async ({ page }) => {
    await page.goto('/calendario-dias-uteis');

    // Guarda contra aprovação por vacuidade: as ações de linha só existem no
    // DOM com a tabela renderizada, e é nelas que mora a cobertura de SC
    // 2.5.3. Sem esta asserção o scan aprovaria a tela de erro ou o
    // empty-state, que é o modo de falha que motivou a issue #677.
    //
    // A asserção é estrutural de propósito: ancorá-la no nome acessível
    // corrigido faria a guarda — e não o axe — pegar uma regressão de rótulo,
    // escondendo justamente o que este spec existe para verificar.
    await expect(page.locator('td.table-responsive__actions a')).toHaveCount(CALENDARIOS.length);

    const resultado = await runAxeWcagAA(page);
    const graves = resultado.violations.filter(
      (violacao) => violacao.impact === 'serious' || violacao.impact === 'critical',
    );
    expect(graves, JSON.stringify(graves, null, 2)).toEqual([]);
  });
});

async function mockCalendariosApi(page: Page): Promise<void> {
  // A coleção é paginada por cursor (ADR-0026), então a URL sempre carrega
  // query string (`limit` ou `cursor`+`direction`). Ancorar o padrão no fim do
  // path deixaria a requisição de lista escapar para a rede.
  await page.route(
    /\/api\/configuracao\/calendarios-dias-uteis(\?.*)?$/,
    async (route, request) => {
      if (request.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: CORS_HEADERS });
        return;
      }
      if (request.method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
        body: JSON.stringify(CALENDARIOS),
      });
    },
  );
}

function metadataTheme(testInfo: TestInfo): VisualTheme {
  const theme = testInfo.project.metadata['theme'];
  return theme === 'dark' || theme === 'contrast' ? theme : 'light';
}
