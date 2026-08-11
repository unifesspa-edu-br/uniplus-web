import { test, expect, type Page, type Route } from '@playwright/test';

type DsTheme = 'light' | 'dark' | 'contrast';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, accept',
};

const TIPOS_PROCESSO = [
  {
    id: '01960000-0000-7000-0000-000000000515',
    codigo: 'SISU',
    nome: 'SISU',
    descricao: 'Seleção unificada pelo ENEM.',
    ativo: true,
    criadoEm: '2026-08-11T00:00:00Z',
  },
] as const;

/**
 * Matriz do Uni+ DS para o cadastro de processo seletivo: 320 px, 768 px e
 * desktop, nos temas claro, escuro e de contraste. Cobre o que o teste
 * unitário não alcança — layout real, scroll, contenção de foco e ausência de
 * transbordo horizontal.
 */
test.describe('Cadastro de processo seletivo — matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await mockTiposProcesso(page);
    await instalarPreferencia(page, temaDoProject(testInfo.project.name));
    await page.goto('/processo-seletivo');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('radio').first()).toBeVisible();
  });

  /**
   * O controle do menu lateral é escolhido por CSS, um botão por largura, sem
   * consultar a viewport em JavaScript: assim o breakpoint vive só na folha de
   * estilo. Cada botão reporta o próprio estado em `aria-expanded`.
   */
  test('expõe um único controle de menu, coerente com a largura', async ({ page }, testInfo) => {
    const menu = controleDeMenu(testInfo.project.name);

    await expect(page.locator(menu.visivel)).toBeVisible();
    await expect(page.locator(menu.oculto)).toBeHidden();
    await expect(page.locator(menu.visivel)).toHaveAttribute('aria-expanded', menu.inicial);

    await page.locator(menu.visivel).click();
    await expect(page.locator(menu.visivel)).toHaveAttribute('aria-expanded', menu.alternado);
  });

  test('mantém um único landmark main', async ({ page }) => {
    await expect(page.getByRole('main')).toHaveCount(1);
  });

  /**
   * Percorre todos os passos: medir só o passo ativo esconde transbordo nos
   * demais, que ficam montados mas ocultos por `[hidden]`.
   */
  test('não transborda horizontalmente em nenhum passo', async ({ page }) => {
    const total = await page.locator('li.steps__item').count();

    for (let passo = 0; passo < total; passo += 1) {
      await page.evaluate((indice) => {
        const botoes = document.querySelectorAll<HTMLButtonElement>('li.steps__item button');
        botoes[indice]?.click();
      }, passo);

      const medida = await page.evaluate(() => {
        const documento = document.documentElement;
        const scroller = document.querySelector('.wiz-content');
        return {
          documento: documento.scrollWidth - documento.clientWidth,
          scroller:
            scroller instanceof HTMLElement ? scroller.scrollWidth - scroller.clientWidth : 0,
        };
      });

      expect(medida.documento, `documento no passo ${passo + 1}`).toBeLessThanOrEqual(1);
      expect(medida.scroller, `scroller no passo ${passo + 1}`).toBeLessThanOrEqual(1);
    }
  });

  test('não transborda horizontalmente', async ({ page }) => {
    const transbordo = await page.evaluate(() => {
      const documento = document.documentElement;
      const excedeDocumento = documento.scrollWidth > documento.clientWidth + 1;

      const scroller = document.querySelector('.wiz-content');
      const excedeScroller =
        scroller instanceof HTMLElement && scroller.scrollWidth > scroller.clientWidth + 1;

      return { excedeDocumento, excedeScroller };
    });

    expect(transbordo.excedeDocumento).toBe(false);
    expect(transbordo.excedeScroller).toBe(false);
  });

  test('avança e volta entre os passos', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Passo 1');

    await page.getByRole('button', { name: 'Próximo' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('tipo de processo seletivo');

    // O radio é `sr-only`; quem recebe o clique é o cartão que o envolve.
    await page.locator('.type-card').first().click();
    await expect(page.getByRole('radio').first()).toBeChecked();
    await page.getByRole('button', { name: 'Próximo' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Passo 2');

    await page.getByRole('button', { name: 'Anterior' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Passo 1');
  });

  test('recusa publicar rascunho incompleto', async ({ page }, testInfo) => {
    const stepper = navegacaoDePassos(page, testInfo.project.name);
    await stepper();

    await page.getByRole('button', { name: 'Publicar' }).click();

    const alerta = page.getByRole('alert');
    await expect(alerta).toBeVisible();
    await expect(alerta).toContainText('Passo 1');
    await expect(page.locator('.publication-message')).toHaveCount(0);
  });
});

/**
 * O menu lateral tem fronteira própria em 1024 px: 768 px ainda usa a gaveta.
 * A lateral das telas largas nasce expandida; a gaveta das estreitas, fechada.
 */
function controleDeMenu(projectName: string): {
  visivel: string;
  oculto: string;
  inicial: string;
  alternado: string;
} {
  const amplo = projectName.includes('desktop') || projectName.includes('-tv-');

  return amplo
    ? {
        visivel: '.sidebar-toggle--amplo',
        oculto: '.sidebar-toggle--compacto',
        inicial: 'true',
        alternado: 'false',
      }
    : {
        visivel: '.sidebar-toggle--compacto',
        oculto: '.sidebar-toggle--amplo',
        inicial: 'false',
        alternado: 'true',
      };
}

/**
 * Abaixo de 768 px o stepper lateral dá lugar à barra de etapas com diálogo;
 * 768 px é a própria fronteira do DS e já mostra a navegação lateral.
 */
function navegacaoDePassos(page: Page, projectName: string): () => Promise<void> {
  const compacto = projectName.includes('-320-');

  if (!compacto) {
    return async () => {
      await page.getByRole('button', { name: 'Revisão e publicação' }).click();
    };
  }

  return async () => {
    await page.getByRole('button', { name: 'Abrir lista de etapas' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Etapas do cadastro' });
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole('button', { name: 'Revisão e publicação' }).click();
    await expect(dialogo).toBeHidden();
  };
}

async function instalarPreferencia(page: Page, theme: DsTheme): Promise<void> {
  await page.addInitScript((dsTheme) => {
    window.localStorage.setItem(
      'uniplus.a11y',
      JSON.stringify({
        theme: dsTheme === 'contrast' ? 'auto' : dsTheme,
        contrast: dsTheme === 'contrast',
        fontMode: 'default',
      }),
    );
  }, theme);
}

function temaDoProject(projectName: string): DsTheme {
  const parte = projectName.split('-').at(-1);
  return parte === 'dark' || parte === 'contrast' ? parte : 'light';
}

/**
 * O CI do frontend sobe Keycloak, mas não a API. O catálogo configurável é
 * contrato do passo 1, portanto a matriz DS o materializa por rota para manter
 * o fluxo determinístico e não voltar a depender de opções hardcoded.
 */
async function mockTiposProcesso(page: Page): Promise<void> {
  await page.route(/\/api\/configuracao\/tipos-processo(\?.*)?$/, async (route: Route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    expect(request.method()).toBe('GET');
    expect(request.headers()['accept']).toBe('application/vnd.uniplus.tipo-processo.v1+json');

    await route.fulfill({
      status: 200,
      contentType: 'application/vnd.uniplus.tipo-processo.v1+json',
      headers: CORS_HEADERS,
      body: JSON.stringify(TIPOS_PROCESSO),
    });
  });
}
