import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import type { AxeResults } from 'axe-core';
import {
  CURSOS_DA_MEDICINA,
  MODALIDADES_DA_MEDICINA,
  OFERTAS_DA_MEDICINA,
  PROCESSO_DA_MEDICINA,
  REFERENCIAS_DEMOGRAFICAS_DA_MEDICINA,
  REGRAS_DE_AJUSTE_DA_MEDICINA,
  REGRAS_DE_CASCATA_DA_MEDICINA,
  REGRAS_DE_DISTRIBUICAO_DA_MEDICINA,
} from '../fixtures/vagas-da-medicina';
import { elementosForaDoCartao } from '../support/limites-do-cartao';
import { blocosColados } from '../support/ritmo-vertical';
import { medirTransbordoHorizontal } from '../support/rolagem-do-editor';

type DsTheme = 'light' | 'dark' | 'contrast';
type Status = 'rascunho' | 'publicado';

/** Abaixo desta largura o stepper lateral dá lugar à barra com diálogo. */
const LARGURA_STEPPER_LATERAL = 768;

/** Abaixo desta largura os cartões aninhados perdem o recuo de cada nível. */
const LARGURA_CARTAO_ANINHADO_ENXUTO = 480;

/**
 * Largura que os recuos de página e de cartões podem consumir, somados, na tela estreita:
 * em 375 px sobram pelo menos 260 px para o conteúdo do cartão mais interno.
 */
const RECUO_MAXIMO_NA_TELA_ESTREITA = 115;

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, accept',
};

/**
 * Matriz do Uni+ DS para o passo Vagas, com o quadro real do processo da Medicina 2027:
 * dez modalidades e a cascata de oito origens, o volume que a tela estreita tem de
 * acomodar. Roda em rascunho e em consulta, porque o processo publicado é o que a
 * comissão confere.
 *
 * O CI do frontend sobe Keycloak, mas não a API: o processo e os catálogos são servidos
 * por rota, e toda outra consulta de catálogo responde vazia.
 */
test.describe('Vagas — matriz DS @ds', () => {
  for (const status of ['rascunho', 'publicado'] as const) {
    test.describe(`processo em ${status}`, () => {
      test.beforeEach(async ({ page }, testInfo) => {
        await abrirVagas(page, testInfo, status);
      });

      /**
       * A asserção é sobre a coleção inteira. `impact` é severidade do axe, não nível de
       * conformidade: filtrar por ele deixaria passar violação de WCAG 2.1 AA classificada
       * como moderada.
       */
      test('não viola WCAG 2.1 AA', async ({ page }) => {
        const resultado = await runAxeWcagAA(page);

        expect(identificadoresDe(resultado)).toEqual([]);
      });

      /**
       * Com a base legal e as garantias abertas: a garantia é fórmula sem espaço, e é o
       * texto que mais força a largura do cartão.
       */
      test('não transborda horizontalmente, nem com as garantias abertas', async ({ page }) => {
        await abrirGarantias(page);

        const transbordo = await medirTransbordoHorizontal(page);
        expect(transbordo.documento).toBeLessThanOrEqual(1);
        expect(transbordo.areaDeTrabalho).toBeLessThanOrEqual(1);
        expect(await elementosForaDoCartao(page)).toEqual([]);
      });

      test('separa título, alerta e dica do bloco vizinho', async ({ page }) => {
        expect(await blocosColados(page)).toEqual([]);
      });
    });
  }

  /**
   * Abaixo de 768 px a matriz e o quadro viram pilhas de cartões, que é onde estes defeitos
   * apareciam. Acima disso são tabelas, e as mesmas asserções valem para a linha da tabela.
   */
  test.describe('quadro e cascata', () => {
    test.beforeEach(async ({ page }, testInfo) => {
      await abrirVagas(page, testInfo, 'publicado');
    });

    /**
     * O código de modalidade é indivisível: "LB_/PCD" partido em duas linhas lê como dois
     * códigos. Um destino por linha também não serve, porque cada origem ocupava a tela.
     */
    test('mostra cada destino da cascata inteiro, vários por linha', async ({ page }) => {
      const cartoes = await page.locator('.cascata-matriz tbody tr').evaluateAll((linhas) =>
        linhas.map((linha) => {
          const destinos = Array.from(linha.querySelectorAll('td'));
          const partidos = destinos.filter((destino) => {
            const intervalo = document.createRange();
            intervalo.selectNodeContents(destino);
            const linhasDoTexto = new Set(
              Array.from(intervalo.getClientRects()).map((caixa) => Math.round(caixa.top)),
            );
            return linhasDoTexto.size > 1;
          });
          const linhasDeDestinos = new Set(
            destinos.map((destino) => Math.round(destino.getBoundingClientRect().top)),
          );
          return {
            origem: (linha.querySelector('th')?.textContent ?? '').trim(),
            partidos: partidos.map((destino) => (destino.textContent ?? '').trim()),
            destinos: destinos.length,
            linhas: linhasDeDestinos.size,
          };
        }),
      );

      expect(cartoes).toHaveLength(8);
      for (const cartao of cartoes) {
        expect(cartao.partidos, `destinos partidos em ${cartao.origem}`).toEqual([]);
        expect(cartao.linhas, `destinos de ${cartao.origem} um por linha`).toBeLessThan(
          cartao.destinos,
        );
      }
    });

    /** Os totais fecham a pilha de cartões das ofertas, com a mesma largura e o mesmo recuo. */
    test('alinha os totais aos cartões das ofertas', async ({ page }) => {
      const oferta = await page.locator('.vagas-table tbody tr').first().boundingBox();
      const totais = await page.locator('.vagas-table tfoot tr').boundingBox();
      const rotuloDaOferta = await page.locator('.vagas-table tbody td').first().boundingBox();
      const rotuloDosTotais = await page.locator('.vagas-table tfoot td').first().boundingBox();

      expect(oferta).not.toBeNull();
      expect(totais).not.toBeNull();
      expect(Math.abs((totais?.x ?? 0) - (oferta?.x ?? 0))).toBeLessThanOrEqual(1);
      expect(Math.abs((totais?.width ?? 0) - (oferta?.width ?? 0))).toBeLessThanOrEqual(1);
      expect(Math.abs((rotuloDosTotais?.x ?? 0) - (rotuloDaOferta?.x ?? 0))).toBeLessThanOrEqual(1);
    });

    /** Cartão dentro de cartão não pode deixar o conteúdo mais interno sem largura útil. */
    test('deixa largura útil ao cartão mais interno', async ({ page }, testInfo) => {
      const largura = larguraDoProject(testInfo);
      const util = await page
        .locator('.cascata-matriz tbody tr')
        .first()
        .evaluate((linha) => {
          const estilo = getComputedStyle(linha);
          return (
            linha.clientWidth - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight)
          );
        });

      // O recuo dos cartões aninhados só é enxugado na tela estreita.
      expect(
        largura >= LARGURA_CARTAO_ANINHADO_ENXUTO ||
          util >= largura - RECUO_MAXIMO_NA_TELA_ESTREITA,
        `largura útil de ${util} px em ${largura} px`,
      ).toBe(true);
    });
  });
});

async function abrirVagas(page: Page, testInfo: TestInfo, status: Status): Promise<void> {
  await mockarApi(page, status);
  await instalarPreferencia(page, temaDoProject(testInfo.project.name));
  await page.goto(`/processo-seletivo/${PROCESSO_DA_MEDICINA.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await irAoPasso(page, 'Vagas', testInfo);
  await expect(page.getByRole('heading', { name: 'Cascata de remanejamento' })).toBeVisible();
  await expect(page.locator('.cascata-matriz tbody tr')).toHaveCount(8);
}

async function abrirGarantias(page: Page): Promise<void> {
  await page.locator('.wiz-content details').evaluateAll((detalhes) => {
    for (const detalhe of detalhes) {
      (detalhe as HTMLDetailsElement).open = true;
    }
  });
}

function larguraDoProject(testInfo: TestInfo): number {
  const largura = testInfo.project.use.viewport?.width;
  if (largura === undefined) {
    throw new Error(`Project ${testInfo.project.name} não declara viewport.`);
  }
  return largura;
}

/**
 * Abaixo de 768 px o stepper lateral dá lugar à barra de etapas com diálogo, e o caminho
 * até um passo muda com ele.
 */
async function irAoPasso(page: Page, rotulo: string, testInfo: TestInfo): Promise<void> {
  if (larguraDoProject(testInfo) >= LARGURA_STEPPER_LATERAL) {
    await page.getByRole('button', { name: rotulo }).click();
    return;
  }

  await page.getByRole('button', { name: 'Abrir lista de etapas' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Etapas do cadastro' });
  await expect(dialogo).toBeVisible();
  await dialogo.getByRole('button', { name: rotulo }).click();
  await expect(dialogo).toBeHidden();
}

/** Falhar por id diz qual regra caiu; a coleção crua não. */
function identificadoresDe(resultado: AxeResults): string[] {
  return resultado.violations.map((violacao) => violacao.id);
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
 * O processo, os documentos do edital e os catálogos que o passo Vagas lê. Toda outra
 * consulta à API responde vazia: os outros passos também carregam catálogos ao abrir o
 * processo, e sem a API no CI eles falhariam por conexão recusada.
 *
 * A rota genérica é registrada primeiro porque o Playwright consulta as rotas da mais
 * recente para a mais antiga.
 */
async function mockarApi(page: Page, status: Status): Promise<void> {
  await responder(page, /\/api\//, []);
  await responder(page, /\/api\/configuracao\/ofertas-curso(\?.*)?$/, OFERTAS_DA_MEDICINA);
  await responder(page, /\/api\/configuracao\/cursos(\?.*)?$/, CURSOS_DA_MEDICINA);
  await responder(page, /\/api\/configuracao\/modalidades(\?.*)?$/, MODALIDADES_DA_MEDICINA);
  await responder(
    page,
    /\/api\/configuracao\/referencias-reserva-demografica(\?.*)?$/,
    REFERENCIAS_DEMOGRAFICAS_DA_MEDICINA,
  );
  await mockarRegrasCatalogo(page);

  const processo = new RegExp(`/api/selecao/processos-seletivos/${PROCESSO_DA_MEDICINA.id}`);
  await page.route(processo, async (route: Route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    const caminho = new URL(request.url()).pathname;
    if (caminho.endsWith(PROCESSO_DA_MEDICINA.id)) {
      await responderCom(route, { ...PROCESSO_DA_MEDICINA, status });
      return;
    }
    if (caminho.endsWith('/documentos-edital')) {
      await responderCom(route, []);
      return;
    }
    await route.fulfill({ status: 404, headers: CORS_HEADERS });
  });
}

/**
 * `regras-catalogo` é filtrado por `tipo`: devolver a mesma lista para qualquer tipo
 * mascararia um filtro quebrado.
 */
async function mockarRegrasCatalogo(page: Page): Promise<void> {
  const porTipo: Record<string, readonly unknown[]> = {
    regra_distribuicao_vagas: REGRAS_DE_DISTRIBUICAO_DA_MEDICINA,
    regra_ajuste_distribuicao_vagas: REGRAS_DE_AJUSTE_DA_MEDICINA,
    criterio_remanejamento: REGRAS_DE_CASCATA_DA_MEDICINA,
  };

  await page.route(/\/api\/selecao\/regras-catalogo(\?.*)?$/, async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    const tipo = new URL(route.request().url()).searchParams.get('tipo') ?? '';
    await responderCom(route, porTipo[tipo] ?? []);
  });
}

async function responder(page: Page, rota: RegExp, corpo: unknown): Promise<void> {
  await page.route(rota, async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    await responderCom(route, corpo);
  });
}

async function responderCom(route: Route, corpo: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: CORS_HEADERS,
    body: JSON.stringify(corpo),
  });
}
