import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';
import { assertSemViolacoesGraves } from '../support/a11y';

type VisualTheme = 'light' | 'dark' | 'contrast';

const CALENDARIO_ID = '019ff7ee-3c00-7976-860c-eb2f61c9b4d1';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const SEM_LOCALIDADE = { municipioIbge: null, municipioNome: null, municipioUf: null, uf: null };

/** Dias de quatro abrangências e dois municípios, para o recorte ter o que esconder (#575). */
const CALENDARIO = {
  id: CALENDARIO_ID,
  versaoDoCalendario: '2026.1',
  vigente: true,
  criadoEm: '2026-08-13T12:00:00Z',
  diasNaoUteis: [
    {
      ...SEM_LOCALIDADE,
      id: '019ff7ee-3c00-7976-860c-eb2f61c9b401',
      abrangencia: { codigo: 'MUNICIPAL', rotulo: 'Municipal' },
      municipioIbge: '1504208',
      municipioNome: 'Marabá',
      municipioUf: 'PA',
      data: '2026-04-05',
      descricao: 'Aniversário de Marabá',
    },
    {
      ...SEM_LOCALIDADE,
      id: '019ff7ee-3c00-7976-860c-eb2f61c9b402',
      abrangencia: { codigo: 'MUNICIPAL', rotulo: 'Municipal' },
      municipioIbge: '1505536',
      municipioNome: 'Parauapebas',
      municipioUf: 'PA',
      data: '2026-05-10',
      descricao: 'Aniversário de Parauapebas',
    },
    {
      ...SEM_LOCALIDADE,
      id: '019ff7ee-3c00-7976-860c-eb2f61c9b403',
      abrangencia: { codigo: 'ESTADUAL', rotulo: 'Estadual' },
      uf: 'PA',
      data: '2026-08-15',
      descricao: 'Adesão do Grão-Pará à Independência',
    },
    {
      ...SEM_LOCALIDADE,
      id: '019ff7ee-3c00-7976-860c-eb2f61c9b404',
      abrangencia: { codigo: 'NACIONAL', rotulo: 'Nacional' },
      data: '2026-09-07',
      descricao: 'Independência do Brasil',
    },
    {
      ...SEM_LOCALIDADE,
      id: '019ff7ee-3c00-7976-860c-eb2f61c9b405',
      abrangencia: { codigo: 'INSTITUCIONAL', rotulo: 'Institucional' },
      data: '2026-10-28',
      descricao: 'Dia do Servidor Público',
    },
  ],
} as const;

test.describe('Calendário de dias úteis — recorte da grade (#575)', () => {
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
    await page.goto(`/calendario-dias-uteis/${CALENDARIO_ID}`);
  });

  test('o município restringe a grade, conta o que está à vista e avisa o que segue valendo', async ({
    page,
  }) => {
    await page.getByLabel('Abrangência').selectOption('MUNICIPAL');
    await page.getByLabel('Município').selectOption({ label: 'Marabá — PA' });

    await expect(page.getByRole('status').filter({ hasText: 'Mostrando' })).toHaveText(
      'Mostrando 1 de 5 dias não úteis.',
    );
    await expect(page.locator('#cfg-recorte-aviso')).toContainText(
      'Em Marabá — PA também valem os dias nacionais',
    );
    await expect(page.locator('.cfg-calendario-mensal__dia--feriado')).toHaveCount(1);
    await expect(
      page.getByRole('button', { name: '10 de maio de 2026: 1 dia não útil oculto pelo filtro' }),
    ).toBeVisible();
  });

  test('o painel do dia oculto mostra a ocorrência marcada como oculta', async ({ page }) => {
    await page.getByLabel('Abrangência').selectOption('NACIONAL');

    await page
      .getByRole('button', { name: /^15 de agosto de 2026: 1 dia não útil oculto/ })
      .click();

    const painel = page.getByRole('dialog', { name: '15 de agosto de 2026' });
    await expect(painel).toContainText('Adesão do Grão-Pará à Independência');
    await expect(painel).toContainText('Oculto pelo filtro');
  });

  test('320 px sem rolagem horizontal com os dois campos à vista', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.getByLabel('Abrangência').selectOption('ESTADUAL');
    await expect(page.getByLabel('Unidade Federativa (UF)')).toBeVisible();

    await assertNoHorizontalOverflow(page);
    await testInfo.attach(`${testInfo.project.name}-calendario-recorte-320`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('sem violações serious/critical, com o recorte ativo e o painel do dia oculto aberto', async ({
    page,
  }) => {
    await page.getByLabel('Abrangência').selectOption('MUNICIPAL');
    await expect(page.getByLabel('Município')).toBeVisible();

    await assertSemViolacoesGraves(page);

    await page
      .getByRole('button', { name: /^7 de setembro de 2026: 1 dia não útil oculto/ })
      .click();
    await expect(page.getByRole('dialog', { name: '7 de setembro de 2026' })).toBeVisible();

    await assertSemViolacoesGraves(page);
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

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
}

function metadataTheme(testInfo: TestInfo): VisualTheme {
  const theme = testInfo.project.metadata['theme'];
  return theme === 'dark' || theme === 'contrast' ? theme : 'light';
}
