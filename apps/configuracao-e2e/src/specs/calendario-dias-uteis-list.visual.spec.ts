import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';
import { runAxeWcagAA } from '@uniplus/shared-e2e';

type VisualTheme = 'light' | 'dark' | 'contrast';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
  // Sem expor `Link`, o navegador entrega a resposta mas esconde o header do
  // JS: os cursores viriam nulos e o pager nunca montaria — silenciosamente.
  'access-control-expose-headers': 'link',
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

/**
 * Com `rel="next"` a página monta o `ui-pager`. Sem isso o componente não
 * entra no DOM e escapa da varredura — foi assim que uma violação de SC 2.5.3
 * no botão "Próximo" sobreviveu em componente usado por todas as listagens.
 */
const LINK_HEADER = '</api/configuracao/calendarios-dias-uteis?cursor=PROXIMA>; rel="next"';

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

    await page.goto('/calendario-dias-uteis');
    // Guarda contra varredura sobre conjunto vazio: as ações de linha e o
    // pager só existem no DOM com a tabela renderizada, e é neles que mora a
    // cobertura de SC 2.5.3. Sem isto o scan aprovaria a tela de erro ou o
    // empty-state — o modo de falha que motivou a issue #677. É estrutural de
    // propósito: ancorada no nome acessível corrigido, seria a guarda, e não o
    // axe, a pegar uma regressão de rótulo.
    await expect(page.locator('table tbody tr')).toHaveCount(CALENDARIOS.length);
    await expect(page.getByRole('navigation', { name: /Paginação/ })).toBeVisible();
  });

  test('aplica o tema selecionado e lista os datasets cadastrados', async ({ page }, testInfo) => {
    await expect(page.locator('html')).toHaveAttribute('data-theme', metadataTheme(testInfo));
    await expect(page.getByRole('heading', { name: 'Calendários', level: 1 })).toBeVisible();
  });

  test('lista não viola WCAG 2.1 A/AA', async ({ page }) => {
    const resultado = await runAxeWcagAA(page);

    // Assere a coleção inteira, não um recorte por severidade: `impact` é
    // severidade do axe, não nível de conformidade. Mapear para o id faz a
    // falha dizer qual regra caiu.
    expect(
      resultado.violations.map((violacao) => violacao.id),
      JSON.stringify(resultado.violations, null, 2),
    ).toEqual([]);
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
        headers: { ...CORS_HEADERS, 'content-type': 'application/json', link: LINK_HEADER },
        body: JSON.stringify(CALENDARIOS),
      });
    },
  );
}

function metadataTheme(testInfo: TestInfo): VisualTheme {
  const theme = testInfo.project.metadata['theme'];
  return theme === 'dark' || theme === 'contrast' ? theme : 'light';
}
