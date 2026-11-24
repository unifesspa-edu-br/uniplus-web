import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import { faseDoServidor } from '../fixtures/cronograma-do-servidor';
import {
  ID_DO_PROCESSO_COMPLETO,
  PROCESSO_PUBLICADO_COMPLETO,
  UNIDADE_RESPONSAVEL_DA_FASE,
} from '../fixtures/processo-publicado-completo';
import {
  CORS,
  mockarApi,
  novoCapturado,
  problema,
  recusar,
} from '../support/api-da-unidade-da-fase';
import { identificadoresDe, medirTransbordo } from '../support/medicoes-do-passo';
import { irAoPasso } from '../support/navega-passo';
import { instalarPreferencia, temaDoProject } from '../support/tema';

const MENSAGEM = 'Fases ligadas por precedência não podem estar no mesmo momento.';
const CODIGO = 'uniplus.selecao.processo_seletivo.fases_com_precedencia_no_mesmo_momento';

function faseAdicional(fase: { id: string; codigo: string }, indice: number) {
  return faseDoServidor({
    id: fase.id,
    codigo: fase.codigo,
    faseCanonica: { origemId: fase.id, coletaInscricao: false },
    cronograma: {
      ordem: indice + 2,
      noMesmoMomentoDaAnterior: indice === 0,
      unidadeResponsavel: UNIDADE_RESPONSAVEL_DA_FASE,
    },
  });
}

function fasesDoCenario() {
  const adicionais = [
    { id: '01a0d640-0000-7000-8000-0000000000e1', codigo: 'HABILITACAO' },
    { id: '01a0d640-0000-7000-8000-0000000000e2', codigo: 'MATRICULA' },
  ];
  return [novoCapturado(UNIDADE_RESPONSAVEL_DA_FASE).fase, ...adicionais.map(faseAdicional)];
}

async function mockarDetalhe(page: Page): Promise<void> {
  const detalhe = {
    ...PROCESSO_PUBLICADO_COMPLETO,
    status: { codigo: 'RASCUNHO', rotulo: 'Rascunho' },
    cronogramaFases: fasesDoCenario(),
    atendimentoEspecializado: null,
    regrasDeComprovacao: PROCESSO_PUBLICADO_COMPLETO.regrasDeComprovacao.slice(0, 1),
    classificacao: { ...PROCESSO_PUBLICADO_COMPLETO.classificacao, regrasEliminacao: [] },
  };
  await page.route(
    new RegExp(`/api/selecao/processos-seletivos/${ID_DO_PROCESSO_COMPLETO}$`),
    async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      await route.fulfill({ json: detalhe, headers: CORS });
    },
  );
}

async function mockarRecusa(page: Page): Promise<void> {
  await page.route('**/cronograma-fases', async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    await recusar(
      route,
      problema(422, 'uniplus.validacao', 'Validação', [
        { field: 'fases[1].noMesmoMomentoDaAnterior', code: CODIGO, message: MENSAGEM },
      ]),
    );
  });
}

async function abrirCronogramaComRecusa(page: Page, testInfo: TestInfo): Promise<void> {
  await mockarApi(page, novoCapturado(UNIDADE_RESPONSAVEL_DA_FASE));
  await instalarPreferencia(page, temaDoProject(testInfo.project.name));
  await mockarDetalhe(page);
  await mockarRecusa(page);
  await page.goto(`/processo-seletivo/${ID_DO_PROCESSO_COMPLETO}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await irAoPasso(page, 'Cronograma', testInfo);
  await page.getByRole('button', { name: /Gravar e avançar/ }).click();
  await expect(page.locator('#cr-mesmo-momento-erro-1')).toContainText(MENSAGEM);
}

async function conferirEspaco(page: Page): Promise<void> {
  const medida = await medirTransbordo(page);
  expect(medida.documento).toBeLessThanOrEqual(1);
  expect(medida.scroller).toBeLessThanOrEqual(1);
  await expect(page.locator('label[for=cr-mesmo-momento-1] .checkbox__box')).toBeVisible();
  await expect(page.locator('#cr-mesmo-momento-erro-1')).toBeVisible();
}

test.describe('Cronograma — recusa da marca do mesmo momento, matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => abrirCronogramaComRecusa(page, testInfo));

  test('associa a ajuda e a recusa à caixa sem violações WCAG 2.1 AA', async ({ page }) => {
    const caixa = page.locator('#cr-mesmo-momento-1');
    await expect(caixa).toBeChecked();
    await expect(caixa).toHaveAttribute('aria-invalid', 'true');
    await expect(caixa).toHaveAttribute(
      'aria-describedby',
      'cr-mesmo-momento-ajuda-1 cr-mesmo-momento-erro-1',
    );
    await expect(page.locator('#cr-mesmo-momento-ajuda-1')).toBeVisible();
    expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);
  });

  test('a 320 px a caixa e a recusa cabem na tela', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await conferirEspaco(page);
    await expect(page.locator('#cr-mesmo-momento-1')).toBeVisible();
  });

  test('a 200% a caixa e a recusa continuam visíveis e utilizáveis', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 450 });
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2';
    });
    await conferirEspaco(page);
    await page.locator('#cr-mesmo-momento-1').focus();
    await page.keyboard.press('Space');
    await expect(page.locator('#cr-mesmo-momento-1')).not.toBeChecked();
  });

  test('Tab alcança a caixa e Espaço alterna a marca', async ({ page }) => {
    const caixa = page.locator('#cr-mesmo-momento-1');
    await page.evaluate(() => {
      (document.activeElement as HTMLElement).blur();
    });
    await expect
      .poll(
        async () => {
          await page.keyboard.press('Tab');
          return caixa.evaluate((elemento) => elemento === document.activeElement);
        },
        { intervals: [0], timeout: 15_000 },
      )
      .toBe(true);
    await expect(caixa).toBeFocused();
    await page.keyboard.press('Space');
    await expect(caixa).not.toBeChecked();
  });
});
