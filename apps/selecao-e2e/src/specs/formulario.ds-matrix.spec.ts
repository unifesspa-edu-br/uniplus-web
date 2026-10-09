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

/** As formas de ancorar a apuração da idade, cada uma com os campos que traz à tela. */
const ANCORAS = [
  { valor: 'DATA_ESPECIFICA', rotulo: 'Uma data fixa' },
  { valor: 'FIM_INSCRICAO', rotulo: 'O fim do período de inscrição' },
  { valor: 'INICIO_FASE', rotulo: 'O início de uma fase' },
  { valor: 'FIM_FASE', rotulo: 'O fim de uma fase' },
  { valor: '', rotulo: 'Não apura idade' },
] as const;

/**
 * Matriz do Uni+ DS para o editor do passo Formulários, com o processo da Medicina 2027 em
 * rascunho: o editor de formulário compartilhado (título, etapas, campos e termos) e a apuração da
 * idade em cada âncora.
 *
 * A consulta do mesmo passo (processo publicado, lido como texto) é coberta por
 * `consulta-como-texto.ds-matrix.spec.ts`, e os alertas de incoerência com o desempate por
 * `desempate-por-idade.ds-matrix.spec.ts`; aqui fica o que é do editor.
 *
 * O CI do frontend sobe Keycloak, mas não a API: o processo e os catálogos são servidos por rota,
 * e toda outra consulta responde vazia.
 */
test.describe('Formulários — editor, matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await abrirFormulario(page, testInfo);
  });

  /**
   * A asserção é sobre a coleção inteira. `impact` é severidade do axe, não nível de
   * conformidade: filtrar por ele deixaria passar violação de WCAG 2.1 AA classificada como
   * moderada.
   */
  test('não viola WCAG 2.1 AA', async ({ page }) => {
    expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);
  });

  test('é editável: título e apuração da idade são controles com rótulo', async ({ page }) => {
    await expect(page.getByLabel('Título do formulário', { exact: true })).toBeEditable();
    await expect(page.getByLabel('Apurar a idade em', { exact: true })).toBeEnabled();
  });

  test('não transborda na horizontal', async ({ page }) => {
    const transbordo = await medirTransbordoHorizontal(page);

    expect(transbordo.documento).toBeLessThanOrEqual(1);
    expect(transbordo.areaDeTrabalho).toBeLessThanOrEqual(1);
  });

  test('separa título, alerta e dica do bloco vizinho', async ({ page }) => {
    expect(await blocosColados(page)).toEqual([]);
  });

  for (const ancora of ANCORAS) {
    test(`apuração da idade em "${ancora.rotulo}": sem violação e sem transbordo`, async ({
      page,
    }) => {
      await page.getByLabel('Apurar a idade em', { exact: true }).selectOption(ancora.valor);

      expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);

      const transbordo = await medirTransbordoHorizontal(page);
      expect(transbordo.documento).toBeLessThanOrEqual(1);
      expect(transbordo.areaDeTrabalho).toBeLessThanOrEqual(1);
      expect(await blocosColados(page)).toEqual([]);
    });
  }
});

async function abrirFormulario(page: Page, testInfo: TestInfo): Promise<void> {
  await mockarApi(page, 'rascunho');
  await instalarPreferencia(page, temaDoProject(testInfo.project.name));
  await page.goto(`/processo-seletivo/${PROCESSO_PUBLICADO_DA_MEDICINA.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await irAoPasso(page, 'Formulários', testInfo);
  // O wizard mantém os passos montados; o título diz qual deles está aberto.
  await expect(page.getByRole('heading', { level: 1, name: /^Passo 11:/ })).toBeVisible();
  await expect(page.getByLabel('Apurar a idade em', { exact: true })).toBeVisible();
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
  await responder(page, /\/api\//, [], { headers: CORS_HEADERS, },);
  await responder(page, /\/api\/configuracao\/tipos-processo(\?.*)?$/, TIPOS_DE_PROCESSO, {
    headers: CORS_HEADERS,
  });
  await responder(page, /\/api\/selecao\/fundamentos-isencao(\?.*)?$/, FUNDAMENTOS_DE_ISENCAO, {
    headers: CORS_HEADERS,
  });

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
      await responderCom(route, { ...PROCESSO_PUBLICADO_DA_MEDICINA, status }, { headers: CORS_HEADERS,}, );
      return;
    }
    if (caminho.endsWith('/documentos-edital')) {
      await responderCom(route, [], { headers: CORS_HEADERS, },);
      return;
    }
    await route.fulfill({ status: 404, headers: CORS_HEADERS });
  });
}
