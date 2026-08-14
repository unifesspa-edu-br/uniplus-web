import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

type VisualTheme = 'light' | 'dark' | 'contrast';
type AxeResult = Awaited<ReturnType<AxeBuilder['analyze']>>;

const CALENDARIO_ID = '019ff7ee-3c00-7976-860c-eb2f61c9b3d1';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

/**
 * Dataset cruzando dois anos, com um dia de múltiplas ocorrências (CA-09) —
 * cobre a grade mensal e o drawer introduzidos pela #525.
 */
const CALENDARIO = {
  id: CALENDARIO_ID,
  versaoDataset: '2026.1',
  vigente: true,
  criadoEm: '2026-08-13T12:00:00Z',
  diasNaoUteis: [
    {
      id: '019ff7ee-3c00-7976-860c-eb2f61c9b301',
      abrangencia: 'MUNICIPAL',
      municipioIbge: '1504208',
      municipioNome: 'Marabá',
      municipioUf: 'PA',
      uf: null,
      data: '2026-04-05',
      descricao: 'Aniversário de Marabá',
    },
    {
      id: '019ff7ee-3c00-7976-860c-eb2f61c9b302',
      abrangencia: 'NACIONAL',
      municipioIbge: null,
      municipioNome: null,
      municipioUf: null,
      uf: null,
      data: '2026-11-15',
      descricao: 'Proclamação da República',
    },
    {
      id: '019ff7ee-3c00-7976-860c-eb2f61c9b303',
      abrangencia: 'INSTITUCIONAL',
      municipioIbge: null,
      municipioNome: null,
      municipioUf: null,
      uf: null,
      data: '2026-11-15',
      descricao: 'Aniversário da Unifesspa',
    },
    {
      id: '019ff7ee-3c00-7976-860c-eb2f61c9b304',
      abrangencia: 'NACIONAL',
      municipioIbge: null,
      municipioNome: null,
      municipioUf: null,
      uf: null,
      data: '2027-01-01',
      descricao: 'Confraternização Universal',
    },
    {
      id: '019ff7ee-3c00-7976-860c-eb2f61c9b305',
      abrangencia: 'INSTITUCIONAL',
      municipioIbge: null,
      municipioNome: null,
      municipioUf: null,
      uf: null,
      data: '2026-06-17',
      // Token único sem espaço, até o limite de 200 caracteres aceito pelo
      // formulário de criação — prova que a prévia quebra a linha em vez de
      // vazar do max-width (CA-06/CA-12).
      descricao: 'A'.repeat(180),
    },
  ],
} as const;

test.describe('Calendário de dias úteis — visualização mensal e drawer (#525)', () => {
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

  test('exibe só os meses com feriado, em ordem cronológica cruzando anos (CA-03)', async ({ page }) => {
    await page.goto(`/calendario-dias-uteis/${CALENDARIO_ID}`);

    const titulos = page.locator('.cfg-calendario-mensal__titulo');
    await expect(titulos).toHaveText([
      'Abril de 2026',
      'Junho de 2026',
      'Novembro de 2026',
      'Janeiro de 2027',
    ]);
  });

  test('abre por clique, fecha pelo botão e restaura o foco no dia exato (CA-07/CA-08)', async ({ page }) => {
    await page.goto(`/calendario-dias-uteis/${CALENDARIO_ID}`);

    const botaoDia = page.getByRole('button', { name: /5 de abril de 2026/ });
    await botaoDia.click();

    const dialogo = page.getByRole('dialog', { name: '5 de abril de 2026' });
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByRole('button', { name: 'Fechar' })).toBeFocused();

    await dialogo.getByRole('button', { name: 'Fechar' }).click();
    await expect(dialogo).toBeHidden();
    await expect(botaoDia).toBeFocused();
    // A restauração de foco dispara (focus) no dia de novo — sem o
    // tratamento em (closed), a prévia reapareceria "sozinha" após fechar.
    await expect(page.locator('.cfg-calendario-mensal__preview')).toBeHidden();
  });

  test('abre por teclado (Enter e Espaço) e Escape fecha restaurando o foco (CA-07/CA-08)', async ({ page }) => {
    await page.goto(`/calendario-dias-uteis/${CALENDARIO_ID}`);

    const botaoDia = page.getByRole('button', { name: /5 de abril de 2026/ });
    const dialogo = page.getByRole('dialog', { name: '5 de abril de 2026' });

    await botaoDia.focus();
    await page.keyboard.press('Enter');
    await expect(dialogo).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeHidden();
    await expect(botaoDia).toBeFocused();

    await botaoDia.focus();
    await page.keyboard.press(' ');
    await expect(dialogo).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(botaoDia).toBeFocused();
  });

  test('múltiplos feriados na mesma data viram uma célula com contador e listam as duas ocorrências (CA-09)', async ({
    page,
  }) => {
    await page.goto(`/calendario-dias-uteis/${CALENDARIO_ID}`);

    const botaoDia = page.getByRole('button', { name: /15 de novembro de 2026/ });
    await expect(botaoDia).toContainText('×2');
    await botaoDia.click();

    const dialogo = page.getByRole('dialog', { name: '15 de novembro de 2026' });
    await expect(dialogo.getByText('Proclamação da República')).toBeVisible();
    await expect(dialogo.getByText('Aniversário da Unifesspa')).toBeVisible();
  });

  test('hover mostra a prévia sem abrir o drawer (CA-06)', async ({ page }) => {
    await page.goto(`/calendario-dias-uteis/${CALENDARIO_ID}`);

    const botaoDia = page.getByRole('button', { name: /5 de abril de 2026/ });
    await botaoDia.hover();

    await expect(page.locator('.cfg-calendario-mensal__preview')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('foco por teclado mostra a prévia; Escape a dispensa sem mover o foco nem abrir o drawer (CA-06)', async ({
    page,
  }) => {
    await page.goto(`/calendario-dias-uteis/${CALENDARIO_ID}`);

    const botaoDia = page.getByRole('button', { name: /5 de abril de 2026/ });
    await botaoDia.focus();
    await expect(page.locator('.cfg-calendario-mensal__preview')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('.cfg-calendario-mensal__preview')).toBeHidden();
    await expect(botaoDia).toBeFocused();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('mouse sair do botão que continua focado não esconde a prévia (CA-06)', async ({ page }) => {
    await page.goto(`/calendario-dias-uteis/${CALENDARIO_ID}`);

    const botaoDia = page.getByRole('button', { name: /5 de abril de 2026/ });
    const previewDoBotao = botaoDia.locator('.cfg-calendario-mensal__preview');

    await botaoDia.focus();
    await botaoDia.hover();
    await expect(previewDoBotao).toBeVisible();

    // Mouse sai do botão que continua com foco de teclado: sem o guard, o
    // mouseleave incondicional esconderia a prévia mesmo com o foco ali, e
    // só voltaria se o usuário tabulasse para longe e de volta.
    await page.mouse.move(0, 0);
    await expect(botaoDia).toBeFocused();
    await expect(previewDoBotao).toBeVisible();

    // Escape ainda dispensa normalmente, sem depender do guard.
    await page.keyboard.press('Escape');
    await expect(previewDoBotao).toBeHidden();
  });

  test('foco sair do botão que o mouse ainda ocupa não esconde a prévia (CA-06)', async ({ page }) => {
    await page.goto(`/calendario-dias-uteis/${CALENDARIO_ID}`);

    const botaoDia = page.getByRole('button', { name: /5 de abril de 2026/ });
    const previewDoBotao = botaoDia.locator('.cfg-calendario-mensal__preview');

    await botaoDia.hover();
    await botaoDia.focus();
    await expect(previewDoBotao).toBeVisible();

    // Foco sai para um elemento sem handler de prévia própria, mas o mouse
    // continua sobre o botão original: sem o guard, o blur incondicional
    // esconderia a prévia mesmo com o cursor ali.
    await page.getByRole('link', { name: 'Voltar à lista' }).focus();
    await expect(previewDoBotao).toBeVisible();
  });

  test('320 px sem rolagem horizontal, inclusive com a prévia aberta (CA-12)', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(`/calendario-dias-uteis/${CALENDARIO_ID}`);

    await assertNoHorizontalOverflow(page);

    // 2026-04-05 é domingo — primeira coluna da grade, o caso mais exposto
    // a ser recortado pela borda esquerda ao centralizar a prévia (CA-12).
    const botaoDia = page.getByRole('button', { name: /5 de abril de 2026/ });
    await botaoDia.focus();
    const preview = page.locator('.cfg-calendario-mensal__preview');
    await expect(preview).toBeVisible();
    await assertNoHorizontalOverflow(page);

    const caixa = await preview.boundingBox();
    expect(caixa?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((caixa?.x ?? 0) + (caixa?.width ?? 9999)).toBeLessThanOrEqual(320);

    await testInfo.attach(`${testInfo.project.name}-calendario-mensal-320`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('descrição longa sem espaços quebra linha na prévia em vez de vazar do max-width (CA-06/CA-12)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(`/calendario-dias-uteis/${CALENDARIO_ID}`);

    const botaoDia = page.getByRole('button', { name: /17 de junho de 2026/ });
    await botaoDia.focus();
    const preview = page.locator('.cfg-calendario-mensal__preview');
    await expect(preview).toBeVisible();

    const caixa = await preview.boundingBox();
    expect(caixa?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((caixa?.x ?? 0) + (caixa?.width ?? 9999)).toBeLessThanOrEqual(320);
    await assertNoHorizontalOverflow(page);

    // O título da ocorrência no drawer usa o mesmo texto sem espaço —
    // precisa quebrar linha em vez de forçar rolagem horizontal do drawer.
    await botaoDia.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test('versão do dataset longa sem espaços não força rolagem horizontal no resumo (CA-02/CA-12)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    // Até 60 caracteres aceitos pelo formulário de criação, num único token.
    const versaoLonga = 'V'.repeat(60);
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
        body: JSON.stringify({ ...CALENDARIO, versaoDataset: versaoLonga }),
      });
    });

    await page.goto(`/calendario-dias-uteis/${CALENDARIO_ID}`);
    await expect(page.getByText(versaoLonga)).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test('sem violações serious/critical, com o drawer fechado e aberto (CA-13)', async ({ page }) => {
    await page.goto(`/calendario-dias-uteis/${CALENDARIO_ID}`);
    await expect(page.getByRole('button', { name: /5 de abril de 2026/ })).toBeVisible();

    const fechado = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(gravesDe(fechado), JSON.stringify(gravesDe(fechado), null, 2)).toEqual([]);

    await page.getByRole('button', { name: /5 de abril de 2026/ }).click();
    await expect(page.getByRole('dialog', { name: '5 de abril de 2026' })).toBeVisible();

    const aberto = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(gravesDe(aberto), JSON.stringify(gravesDe(aberto), null, 2)).toEqual([]);
  });
});

function gravesDe(resultado: AxeResult) {
  return resultado.violations.filter(
    (violacao) => violacao.impact === 'serious' || violacao.impact === 'critical',
  );
}

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
