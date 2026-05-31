import { runAxeWcagAA } from '@uniplus/shared-e2e';
import { test, expect } from '../fixtures/auth.fixture';

/**
 * Cobre os fluxos 5xx do `EditaisListPage`, `EditaisCreatePage` e
 * `EditaisDetailPage` consumindo `NotificationService.errorFromProblem` +
 * `DataTableComponent` (PR-A `20210dd` + PR-B `f7a72d9` + PR-C `be043b2`).
 *
 * Mocks por `page.route` evitam dependência do `uniplus-api` real para
 * exercitar 503 controlado — o storageState carregado pelo `auth-setup`
 * cobre o lado Keycloak (sessão válida sem login UI).
 *
 * Roda em `selecao-authenticated` (projeto chromium-only com
 * `storageState`), portanto `navigator.clipboard.writeText` está disponível
 * via `context.grantPermissions`.
 */

const TRACE_ID = '0123456789abcdef0123456789abcdef';

const PROBLEM_503 = {
  type: 'https://uniplus.unifesspa.edu.br/errors/uniplus.test.indisponivel',
  title: 'Servico temporariamente indisponivel.',
  status: 503,
  code: 'uniplus.test.indisponivel',
  traceId: TRACE_ID,
  detail: 'Tente novamente em alguns instantes.',
} as const;

const PROBLEM_HEADERS = {
  'content-type': 'application/problem+json',
} as const;

const EDITAL_OK = {
  id: '01960000-0000-7000-0000-000000000111',
  numeroEdital: 1,
  anoEdital: 2026,
  titulo: 'Edital de teste apos retry',
  tipoProcesso: 1,
  status: 'Rascunho',
  maximoOpcoesCurso: 2,
  bonusRegionalHabilitado: false,
  criadoEm: '2026-05-10T00:00:00Z',
  _links: {
    self: { href: '/api/editais/01960000-0000-7000-0000-000000000111' },
  },
} as const;

test.describe('Editais — fluxos 5xx (CA-08 da Story #171)', () => {
  test.describe('CA-08.1 listagem 503 → toast persistente + retry + banner consistente', () => {
    test('mostra toast com trace-id, banner inline com mesma mensagem; retry recarrega para 200', async ({
      page,
    }) => {
      // 1ª chamada GET /api/editais → 503 (problem+json); 2ª → 200 com 1 edital.
      let getListCalls = 0;
      await page.route(/\/api\/editais(\?[^/]*)?$/, async (route, request) => {
        if (request.method() !== 'GET') {
          await route.continue();
          return;
        }
        getListCalls += 1;
        if (getListCalls === 1) {
          await route.fulfill({
            status: 503,
            headers: { ...PROBLEM_HEADERS },
            body: JSON.stringify(PROBLEM_503),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify([EDITAL_OK]),
        });
      });

      await page.goto('/editais');

      // Toast aparece com trace-id e botão copy focável + aria-label estável.
      const toast = page.getByTestId('notification-host-toast-error').first();
      await expect(toast).toBeVisible();
      await expect(toast.getByTestId('notification-host-title')).toHaveText(
        PROBLEM_503.title,
      );
      await expect(toast.getByTestId('notification-host-trace-id')).toHaveText(
        TRACE_ID,
      );

      const copyBtn = toast.getByTestId('notification-host-copy-trace');
      await expect(copyBtn).toBeVisible();
      await expect(copyBtn).toHaveAttribute(
        'aria-label',
        `Copiar ID de rastreamento ${TRACE_ID}`,
      );
      await copyBtn.focus();
      await expect(copyBtn).toBeFocused();

      // Banner inline na tabela (mesma mensagem + mesmo trace-id consistente).
      const errorCell = page.getByTestId('data-table-error-cell');
      await expect(errorCell).toBeVisible();
      await expect(
        errorCell.getByTestId('data-table-error-message'),
      ).toHaveText(PROBLEM_503.title);
      await expect(
        errorCell.getByTestId('data-table-error-trace-id'),
      ).toHaveText(TRACE_ID);

      // Retry recarrega lista — 2ª chamada retorna 200 com 1 edital.
      await page.getByTestId('data-table-retry').click();
      await expect(page.getByTestId('data-table-row').first()).toBeVisible();
      // Estado de erro no tbody desaparece quando há linhas carregadas.
      await expect(page.getByTestId('data-table-error-cell')).toHaveCount(0);

      expect(getListCalls).toBe(2);
    });

    test('botao copy escreve traceId no clipboard via navigator.clipboard.writeText', async ({
      page,
      context,
    }) => {
      // Permissions concedidas em runtime — o projeto authenticated roda
      // chromium-only (config), então grantPermissions é seguro aqui.
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);

      await page.route(/\/api\/editais(\?[^/]*)?$/, async (route, request) => {
        if (request.method() !== 'GET') {
          await route.continue();
          return;
        }
        await route.fulfill({
          status: 503,
          headers: { ...PROBLEM_HEADERS },
          body: JSON.stringify(PROBLEM_503),
        });
      });

      await page.goto('/editais');
      const copyBtn = page
        .getByTestId('notification-host-toast-error')
        .first()
        .getByTestId('notification-host-copy-trace');
      await expect(copyBtn).toBeVisible();

      await copyBtn.click();
      // aria-pressed reflete que o estado "Copiado!" foi alcançado — o
      // componente só atualiza a flag após resolve do clipboard.writeText.
      await expect(copyBtn).toHaveAttribute('aria-pressed', 'true');

      const clipboardText = await page.evaluate(() =>
        navigator.clipboard.readText(),
      );
      expect(clipboardText).toBe(TRACE_ID);
    });
  });

  test.describe('CA-08.2 POST /api/editais 503 → toast persistente + banner inline simultâneos', () => {
    test('submit valido com 503 dispara toast e mantém role=alert no form', async ({
      page,
    }) => {
      await page.route(/\/api\/editais$/, async (route, request) => {
        if (request.method() !== 'POST') {
          await route.continue();
          return;
        }
        await route.fulfill({
          status: 503,
          headers: { ...PROBLEM_HEADERS },
          body: JSON.stringify(PROBLEM_503),
        });
      });

      await page.goto('/editais/novo');
      await expect(page.getByRole('heading', { name: 'Novo edital', level: 1 })).toBeVisible();

      // Preenche o form com valores válidos para todos os validators
      // declarados em `editais-create.page.ts`.
      await page.getByLabel('Número do edital').fill('1');
      await page.getByLabel('Ano').fill('2026');
      await page.getByLabel('Título').fill('Edital de teste E2E');
      await page.getByLabel('Tipo de processo (código numérico)').fill('1');
      // Máximo de opções de curso default = 1 (válido), não precisa preencher.

      const submitBtn = page.getByRole('button', { name: 'Criar edital' });
      await expect(submitBtn).toBeEnabled();
      await submitBtn.click();

      // Banner inline na page é `<div role="alert">`; o toast renderiza
      // `<article role="alert">` e a DataTable usa `<td role="alert">`, então
      // restringir a `div[role="alert"]` desambigua sem depender de hasText.
      const banner = page.locator('div[role="alert"]');
      await expect(banner).toBeVisible();
      await expect(banner).toContainText(PROBLEM_503.title);

      // Toast persistente dispara em paralelo, com trace-id copiável.
      const toast = page.getByTestId('notification-host-toast-error').first();
      await expect(toast).toBeVisible();
      await expect(toast.getByTestId('notification-host-trace-id')).toHaveText(
        TRACE_ID,
      );
    });
  });

  test.describe('CA-08.3 GET /api/editais/{id} 503 → effect dispara toast', () => {
    test('detalhe com 503 mantém role=alert na page e dispara toast persistente via effect()', async ({
      page,
    }) => {
      const detailId = '01960000-0000-7000-0000-0000000005ff';
      await page.route(
        new RegExp(`/api/editais/${detailId}$`),
        async (route, request) => {
          if (request.method() !== 'GET') {
            await route.continue();
            return;
          }
          await route.fulfill({
            status: 503,
            headers: { ...PROBLEM_HEADERS },
            body: JSON.stringify(PROBLEM_503),
          });
        },
      );

      await page.goto(`/editais/${detailId}`);

      // Banner role=alert na page — usa hasText para desambiguar do toast.
      await expect(
        page.locator('div[role="alert"]', { hasText: PROBLEM_503.title }),
      ).toBeVisible();

      // Toast disparado pelo effect() em editais-detail.page.ts.
      const toast = page.getByTestId('notification-host-toast-error').first();
      await expect(toast).toBeVisible();
      await expect(toast.getByTestId('notification-host-trace-id')).toHaveText(
        TRACE_ID,
      );
    });
  });

  test.describe('CA-08.4 axe-core zero violations no estado de erro DataTable + NotificationHost', () => {
    test('listagem em estado de erro (banner DataTable + toast aberto) sem violations WCAG A/AA', async ({
      page,
    }) => {
      await page.route(/\/api\/editais(\?[^/]*)?$/, async (route, request) => {
        if (request.method() !== 'GET') {
          await route.continue();
          return;
        }
        await route.fulfill({
          status: 503,
          headers: { ...PROBLEM_HEADERS },
          body: JSON.stringify(PROBLEM_503),
        });
      });

      await page.goto('/editais');
      // Aguarda os DOIS estados estáveis antes do scan: o axe analisa o
      // snapshot do DOM e perde elementos que ainda não montaram.
      await expect(page.getByTestId('data-table-error-cell')).toBeVisible();
      await expect(
        page.getByTestId('notification-host-toast-error').first(),
      ).toBeVisible();

      const results = await runAxeWcagAA(page);
      expect(results.violations).toEqual([]);
    });
  });
});
