import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';
import { assertSemViolacoesGraves } from '../support/a11y';

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

test.describe('Calendário de dias úteis — localidade no detalhe (#524)', () => {
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
    const chamadasGeo = await rastrearChamadasGeo(page);
    await page.goto(`/calendario-dias-uteis/${CALENDARIO_ID}`);

    await expect(page.locator('html')).toHaveAttribute('data-theme', metadataTheme(testInfo));
    await expect(page.getByRole('heading', { name: 'Detalhes', level: 1 })).toBeVisible();

    // Localidade é conteúdo do drawer (#525), não mais texto direto na página
    // nem controle de formulário desabilitado.
    await page.getByRole('button', { name: /5 de abril de 2026/ }).click();
    const drawerMunicipal = page.getByRole('dialog', { name: '5 de abril de 2026' });
    await expect(drawerMunicipal).toBeVisible();
    await expect(drawerMunicipal.getByText('Marabá — PA', { exact: true })).toBeVisible();
    await expect(drawerMunicipal.getByText('Código IBGE: 1504208', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawerMunicipal).toBeHidden();

    await page.getByRole('button', { name: /15 de agosto de 2026/ }).click();
    const drawerEstadual = page.getByRole('dialog', { name: '15 de agosto de 2026' });
    await expect(drawerEstadual).toBeVisible();
    await expect(drawerEstadual.getByText('Pará — PA', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawerEstadual).toBeHidden();

    expect(chamadasGeo).toEqual([]);

    await testInfo.attach(`${testInfo.project.name}-calendario-detalhe`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    // 320 px é o piso de largura exigido pelo e-MAG/WCAG para reflow.
    // A ausência de rolagem horizontal em 320 px, com o drawer aberto, é
    // coberta em calendario-dias-uteis-mensal.visual.spec.ts (#525) —
    // aqui bastaria duplicar a asserção sem cobertura adicional.
    await page.setViewportSize({ width: 320, height: 720 });
    await page.getByRole('button', { name: /5 de abril de 2026/ }).click();
    await expect(page.getByRole('dialog', { name: '5 de abril de 2026' })).toBeVisible();
    await testInfo.attach(`${testInfo.project.name}-calendario-detalhe-320`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('detalhe não tem violações serious/critical', async ({ page }) => {
    await page.goto(`/calendario-dias-uteis/${CALENDARIO_ID}`);
    await expect(page.getByRole('button', { name: /5 de abril de 2026/ })).toBeVisible();

    await assertSemViolacoesGraves(page);
  });
});

async function mockCalendarioApi(page: Page): Promise<void> {
  await page.route(/\/api\/configuracao\/calendarios-dias-uteis\/[^/?]+$/, async (route, request) => {
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
  });
}

/** Registra qualquer leitura do módulo Geo — o detalhe não pode fazer nenhuma. */
async function rastrearChamadasGeo(page: Page): Promise<string[]> {
  const chamadas: string[] = [];
  await page.route(/\/api\/(cidades|cep)(\/|\?|$)/, async (route, request) => {
    chamadas.push(request.url());
    await route.fulfill({
      status: 200,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
      body: '[]',
    });
  });
  return chamadas;
}

function metadataTheme(testInfo: TestInfo): VisualTheme {
  const theme = testInfo.project.metadata['theme'];
  return theme === 'dark' || theme === 'contrast' ? theme : 'light';
}
