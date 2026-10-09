import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import type { AxeResults } from 'axe-core';
import {
  FUNDAMENTOS_DE_ISENCAO,
  PROCESSO_PUBLICADO_DA_MEDICINA,
  TIPOS_DE_PROCESSO,
} from '../fixtures/consulta-da-medicina';
import { blocosColados } from '../support/ritmo-vertical';
import { medirTransbordoHorizontal } from '../support/rolagem-do-editor';
import { irAoPasso } from '../support/navega-passo';
import { instalarPreferencia, temaDoProject } from '../support/tema';
import { responder, responderCom } from '../support/responder';

type Status = 'rascunho' | 'publicado';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, accept',
};

/** Cada passo lido como texto, a posição dele no wizard e um valor que a leitura tem de mostrar. */
const PASSOS = [
  { rotulo: 'Tipo do processo', numero: 1, valor: 'Processo Seletivo de Medicina' },
  { rotulo: 'Identificação', numero: 2, valor: 'medicina-2027' },
  { rotulo: 'Pagamento', numero: 3, valor: 'R$ 120,50' },
  { rotulo: 'Atend. especial', numero: 10, valor: 'Prova ampliada' },
  { rotulo: 'Formulários', numero: 11, valor: 'Opcional' },
] as const;

type Passo = (typeof PASSOS)[number];

const passoPeloRotulo = (rotulo: Passo['rotulo']): Passo =>
  PASSOS.find((passo) => passo.rotulo === rotulo) as Passo;

/**
 * Consulta como texto (web#905, decisão D1): no processo publicado, o valor gravado aparece
 * como texto, associado ao rótulo, e não em controle desabilitado — cujo cinza não alcança o
 * contraste de texto e que corta o valor longo. Nenhum controle inerte fica na ordem de foco.
 *
 * O CI do frontend sobe Keycloak, mas não a API: o processo e os catálogos que os passos
 * leem são servidos por rota, e toda outra consulta de catálogo responde vazia.
 */
test.describe('Consulta como texto — matriz DS @ds', () => {
  for (const passo of PASSOS) {
    test.describe(`passo ${passo.numero}, ${passo.rotulo}`, () => {
      test.beforeEach(async ({ page }, testInfo) => {
        await abrirPasso(page, testInfo, 'publicado', passo);
      });

      /**
       * A asserção é sobre a coleção inteira. `impact` é severidade do axe, não nível de
       * conformidade: filtrar por ele deixaria passar violação de WCAG 2.1 AA classificada
       * como moderada.
       */
      test('não viola WCAG 2.1 AA', async ({ page }) => {
        expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);
      });

      test('mostra o valor gravado como texto, sem controle de formulário', async ({ page }) => {
        await expect(
          page.locator('.wiz-content').getByText(passo.valor, { exact: true }).first(),
        ).toBeVisible();
        expect(await visiveis(page, 'input, select, textarea, button')).toEqual([]);
      });

      test('associa cada valor a um rótulo que está na tela', async ({ page }) => {
        const semRotulo = await page
          .locator('.wiz-content .valor-em-consulta')
          .evaluateAll((valores) =>
            valores
              .filter((valor) => valor.checkVisibility())
              .filter((valor) => {
                if (valor.querySelector('dt')?.textContent?.trim()) return false;
                const id = valor
                  .querySelector('[aria-labelledby]')
                  ?.getAttribute('aria-labelledby');
                const titulo = id ? document.getElementById(id) : null;
                return !titulo?.checkVisibility();
              })
              .map((valor) => (valor.textContent ?? '').trim()),
          );

        expect(semRotulo).toEqual([]);
      });

      test('não transborda na horizontal', async ({ page }) => {
        const transbordo = await medirTransbordoHorizontal(page);

        expect(transbordo.documento).toBeLessThanOrEqual(1);
        expect(transbordo.areaDeTrabalho).toBeLessThanOrEqual(1);
      });

      test('separa título, alerta e dica do bloco vizinho', async ({ page }) => {
        expect(await blocosColados(page)).toEqual([]);
      });
    });
  }

  /** Em rascunho o passo continua sendo formulário: a leitura como texto é só da consulta. */
  test('mantém o formulário em rascunho', async ({ page }, testInfo) => {
    await abrirPasso(page, testInfo, 'rascunho', passoPeloRotulo('Pagamento'));

    await expect(page.getByRole('radio', { name: 'Este processo cobra taxa' })).toBeChecked();
    expect(await visiveis(page, '.valor-em-consulta')).toEqual([]);
  });
});

async function abrirPasso(
  page: Page,
  testInfo: TestInfo,
  status: Status,
  passo: Passo,
): Promise<void> {
  await mockarApi(page, status);
  await instalarPreferencia(page, temaDoProject(testInfo.project.name));
  await page.goto(`/processo-seletivo/${PROCESSO_PUBLICADO_DA_MEDICINA.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await irAoPasso(page, passo.rotulo, testInfo);
  // O wizard mantém os passos montados; o título diz qual deles está aberto.
  await expect(
    page.getByRole('heading', { level: 1, name: new RegExp(`^Passo ${passo.numero}:`) }),
  ).toBeVisible();
}

/**
 * O que casa com o seletor e está visível no passo aberto. O wizard mantém os outros passos
 * montados e ocultos, e o que é deles não conta.
 */
async function visiveis(page: Page, seletor: string): Promise<string[]> {
  return page
    .locator('.wiz-content')
    .locator(seletor)
    .evaluateAll((elementos) =>
      elementos
        .filter((elemento) => elemento.checkVisibility())
        .map((elemento) => elemento.outerHTML.slice(0, 120)),
    );
}

/** Falhar por id diz qual regra caiu; a coleção crua não. */
function identificadoresDe(resultado: AxeResults): string[] {
  return resultado.violations.map((violacao) => violacao.id);
}

/**
 * O processo e os catálogos que os passos lidos consultam. Toda outra consulta à API
 * responde vazia: os outros passos também carregam catálogos ao abrir o processo, e sem a
 * API no CI eles falhariam por conexão recusada.
 *
 * A rota genérica é registrada primeiro porque o Playwright consulta as rotas da mais
 * recente para a mais antiga.
 */
async function mockarApi(page: Page, status: Status): Promise<void> {
  await responder(page, /\/api\//, [], CORS_HEADERS);
  await responder(
    page,
    /\/api\/configuracao\/tipos-processo(\?.*)?$/,
    TIPOS_DE_PROCESSO,
    CORS_HEADERS,
  );
  await responder(
    page,
    /\/api\/selecao\/fundamentos-isencao(\?.*)?$/,
    FUNDAMENTOS_DE_ISENCAO,
    CORS_HEADERS,
  );

  const processo = new RegExp(
    `/api/selecao/processos-seletivos/${PROCESSO_PUBLICADO_DA_MEDICINA.id}`,
  );
  await page.route(processo, async (route: Route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    const caminho = new URL(request.url()).pathname;
    if (caminho.endsWith(PROCESSO_PUBLICADO_DA_MEDICINA.id)) {
      await responderCom(route, { ...PROCESSO_PUBLICADO_DA_MEDICINA, status }, CORS_HEADERS);
      return;
    }
    if (caminho.endsWith('/documentos-edital')) {
      await responderCom(route, [], CORS_HEADERS);
      return;
    }
    await route.fulfill({ status: 404, headers: CORS_HEADERS });
  });
}
