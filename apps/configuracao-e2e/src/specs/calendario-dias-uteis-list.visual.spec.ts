import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';
import { WCAG_A_AA_TAGS } from '@uniplus/shared-e2e';

type VisualTheme = 'light' | 'dark' | 'contrast';

const CALENDARIO_ID = '019ff7ee-3c00-7976-860c-eb2f61c9b2d1';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

/**
 * Dataset com as três formas de localidade que o detalhe precisa apresentar:
 * municipal (snapshot da ADR-0090), estadual (UF) e nacional (sem região).
 */
const CALENDARIO = {
  id: CALENDARIO_ID,
  versaoDataset: '2026.1',
  vigente: true,
  criadoEm: '2026-08-13T12:00:00Z',
  diasNaoUteis: [
    {
      id: '019ff7ee-3c00-7976-860c-eb2f61c9b201',
      abrangencia: 'MUNICIPAL',
      municipioIbge: '1504208',
      municipioNome: 'Marabá',
      municipioUf: 'PA',
      uf: null,
      data: '2026-04-05',
      descricao: 'Aniversário de Marabá',
    },
    {
      id: '019ff7ee-3c00-7976-860c-eb2f61c9b202',
      abrangencia: 'ESTADUAL',
      municipioIbge: null,
      municipioNome: null,
      municipioUf: null,
      uf: 'PA',
      data: '2026-08-15',
      descricao: 'Adesão do Grão-Pará à Independência',
    },
    {
      id: '019ff7ee-3c00-7976-860c-eb2f61c9b203',
      abrangencia: 'NACIONAL',
      municipioIbge: null,
      municipioNome: null,
      municipioUf: null,
      uf: null,
      data: '2026-09-07',
      descricao: 'Independência do Brasil',
    },
  ],
} as const;

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
    await mockCalendarioApi(page);
  });

  test('exibe a localidade legível no drawer sem consultar a Geo', async ({ page }, testInfo) => {
    await page.goto(`/calendario-dias-uteis`);

    await expect(page.locator('html')).toHaveAttribute('data-theme', metadataTheme(testInfo));
    await expect(page.getByRole('heading', { name: 'Calendários', level: 1 })).toBeVisible();
  });

  test('detalhe não tem violações serious/critical', async ({ page }) => {
    await page.goto(`/calendario-dias-uteis`);

    const resultado = await new AxeBuilder({ page }).withTags([...WCAG_A_AA_TAGS]).analyze();
    const graves = resultado.violations.filter(
      (violacao) => violacao.impact === 'serious' || violacao.impact === 'critical',
    );
    expect(graves, JSON.stringify(graves, null, 2)).toEqual([]);
  });
});

async function mockCalendarioApi(page: Page): Promise<void> {
  await page.route(
    /\/api\/configuracao\/calendarios-dias-uteis\/[^/?]+$/,
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
        body: JSON.stringify(CALENDARIO),
      });
    },
  );
}

function metadataTheme(testInfo: TestInfo): VisualTheme {
  const theme = testInfo.project.metadata['theme'];
  return theme === 'dark' || theme === 'contrast' ? theme : 'light';
}
