import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import type { AxeResults } from 'axe-core';
import { FUNDAMENTOS_DE_ISENCAO, TIPOS_DE_PROCESSO } from '../fixtures/consulta-da-medicina';
import {
  ATO_PUBLICADO,
  DOCUMENTO_DO_EDITAL,
  FASES_CANONICAS,
  ID_DO_PROCESSO_COMPLETO,
  PROCESSO_PUBLICADO_COMPLETO,
  SNAPSHOT_VIGENTE,
} from '../fixtures/processo-publicado-completo';
import { blocosColados } from '../support/ritmo-vertical';
import { medirTransbordoHorizontal } from '../support/rolagem-do-editor';

type DsTheme = 'light' | 'dark' | 'contrast';
type Status = 'rascunho' | 'publicado';

/** Abaixo desta largura o stepper lateral dá lugar à barra com diálogo. */
const LARGURA_STEPPER_LATERAL = 768;

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, accept',
};

/**
 * Os 12 passos do wizard, na ordem do stepper, e o que a leitura de cada um tem de mostrar.
 *
 * As 14 telas de passo da web#905 são estas 12 mais a Fase, que mora dentro do Cronograma, e a
 * Classificação, que mora dentro da Fórmula.
 */
const PASSOS: readonly Passo[] = [
  { numero: 1, rotulo: 'Tipo do processo', esperado: 'Processo Seletivo de Medicina' },
  { numero: 2, rotulo: 'Identificação', esperado: 'medicina-2027' },
  { numero: 3, rotulo: 'Pagamento', esperado: 'R$ 120,50' },
  { numero: 4, rotulo: 'Vagas', esperado: 'Quadro de vagas' },
  {
    numero: 5,
    rotulo: 'Cronograma',
    esperado: 'Documentos exigidos nesta fase',
  },
  { numero: 6, rotulo: 'Fórmula e precisão', esperado: 'Regra de cálculo' },
  { numero: 7, rotulo: 'Bônus', esperado: 'Bônus regional' },
  { numero: 8, rotulo: 'Desempate', esperado: 'Regra do critério' },
  { numero: 9, rotulo: 'Eliminação', esperado: 'Regra de eliminação 1' },
  { numero: 10, rotulo: 'Atend. especial', esperado: 'Prova ampliada' },
  { numero: 11, rotulo: 'Formulários', esperado: 'Opcional' },
  {
    numero: 12,
    rotulo: 'Revisão e publicação',
    esperado: 'Número do ato',
  },
] as const;

interface Passo {
  readonly numero: number;
  readonly rotulo: string;
  readonly esperado: string;
}

/** O que um usuário opera: qualquer um destes, visível, é controle de formulário ou de edição. */
const SELETOR_DE_CONTROLES = [
  'input',
  'select',
  'textarea',
  'button',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="combobox"]',
  '[role="textbox"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="spinbutton"]',
].join(', ');

/**
 * Ações de leitura que são botão: abrir o edital já publicado não edita nada. Qualquer outro
 * botão em consulta é ação de edição.
 */
const BOTOES_DE_LEITURA = ['Abrir o edital'];

/** As ações de edição que a web#905 nomeia: nenhuma pode ter nome acessível em consulta. */
const ACOES_DE_EDICAO =
  /Salvar rascunho|Descartar rascunho|Acrescentar|Remover|Subir|Descer|Marcar todas|Simular|Atualizar checklist|Aplicar o padrão|Recompor|Publicar/;

/**
 * Varredura final da consulta (web#905, fatia 5): todos os passos do processo publicado, nas 15
 * combinações de largura e tema da matriz DS. Em nenhum aparece controle de formulário nem ação
 * de edição — o valor gravado é lido como texto —, e o axe não acusa violação de WCAG 2.1 AA.
 *
 * O CI do frontend sobe Keycloak, mas não a API: o processo e os catálogos que os passos leem
 * são servidos por rota, e toda outra consulta de catálogo responde vazia.
 */
test.describe('Varredura da consulta — todos os passos, matriz DS @ds', () => {
  for (const passo of PASSOS) {
    test.describe(`passo ${passo.numero}, ${passo.rotulo}`, () => {
      test.beforeEach(async ({ page }, testInfo) => {
        await abrirPasso(page, testInfo, 'publicado', passo);
      });

      test('lê o processo gravado, sem nenhum controle de formulário nem ação de edição', async ({
        page,
      }) => {
        await expect(
          page.locator('.wiz-content').getByText(passo.esperado, { exact: true }).first(),
        ).toBeVisible();
        expect(await controlesVisiveis(page)).toEqual([]);
        await expect(page.getByRole('button', { name: ACOES_DE_EDICAO })).toHaveCount(0);
      });

      test('não viola WCAG 2.1 AA', async ({ page }) => {
        expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);
      });

      test('não transborda na horizontal e separa título, alerta e dica do bloco vizinho', async ({
        page,
      }) => {
        const transbordo = await medirTransbordoHorizontal(page);

        expect(transbordo.documento).toBeLessThanOrEqual(1);
        expect(transbordo.areaDeTrabalho).toBeLessThanOrEqual(1);
        expect(await blocosColados(page)).toEqual([]);
      });
    });
  }

  /**
   * A varredura só vale se enxergar o que procura. Aqui o passo é sabotado — um campo, uma
   * ação de edição e um botão por papel entram na leitura — e o detector tem de acusar os três;
   * o mesmo vale para a asserção que nomeia as ações de edição.
   */
  test('falha quando um controle reaparece na leitura', async ({ page }, testInfo) => {
    await abrirPasso(page, testInfo, 'publicado', PASSOS[2]);
    expect(await controlesVisiveis(page)).toEqual([]);

    await page.locator('.wiz-content').evaluate((raiz) => {
      raiz.insertAdjacentHTML(
        'beforeend',
        '<input id="sabotagem-campo" aria-label="Valor" />' +
          '<button id="sabotagem-acao" type="button">Remover</button>' +
          '<div id="sabotagem-papel" role="button" tabindex="0">Acrescentar</div>',
      );
    });

    const achados = await controlesVisiveis(page);
    expect(achados).toEqual(
      expect.arrayContaining(['sabotagem-campo', 'sabotagem-acao', 'sabotagem-papel']),
    );
    await expect(page.getByRole('button', { name: ACOES_DE_EDICAO })).toHaveCount(2);
  });
});

/**
 * Em rascunho os mesmos passos são formulário: a varredura acima só prova alguma coisa se, com
 * o processo editável, ela encontrar os controles. E é em edição que o valor longo precisa ser
 * lido inteiro (CA-04): o campo não quebra linha, então o `title` repete o que ele corta.
 */
test.describe('Valor longo em edição — todos os passos, matriz DS @ds', () => {
  for (const passo of PASSOS) {
    test(`passo ${passo.numero}, ${passo.rotulo}: o que o campo corta fica legível em title`, async ({
      page,
    }, testInfo) => {
      await abrirPasso(page, testInfo, 'rascunho', passo);

      expect(await camposCortadosSemTitle(page)).toEqual([]);
    });
  }

  test('em rascunho a varredura encontra os controles que a consulta não tem', async ({
    page,
  }, testInfo) => {
    for (const rotulo of ['Identificação', 'Pagamento', 'Vagas', 'Cronograma'] as const) {
      const passo = PASSOS.find((item) => item.rotulo === rotulo) as Passo;
      await abrirPasso(page, testInfo, 'rascunho', passo);

      expect((await controlesVisiveis(page)).length, `controles de ${rotulo}`).toBeGreaterThan(0);
    }
  });

  test('o valor muito longo é lido inteiro em title e deixa de sê-lo quando cabe', async ({
    page,
  }, testInfo) => {
    await abrirPasso(page, testInfo, 'rascunho', PASSOS[2]);
    const valor = page.getByLabel('Valor da taxa');
    const longo = '1234567890'.repeat(60);

    await valor.fill(longo);
    await expect(valor).toHaveAttribute('title', longo);

    await valor.fill('120,50');
    await expect(valor).not.toHaveAttribute('title', /.+/);
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
  await page.goto(`/processo-seletivo/${ID_DO_PROCESSO_COMPLETO}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await irAoPasso(page, passo.rotulo, testInfo);
  // O wizard mantém os passos montados; o título diz qual deles está aberto.
  await expect(
    page.getByRole('heading', { level: 1, name: new RegExp(`^Passo ${passo.numero}:`) }),
  ).toBeVisible();
  if (status === 'publicado') {
    await expect(page.locator('.wiz-content .valor-em-consulta:visible').first()).toBeVisible();
  }
}

/**
 * Os controles visíveis no passo aberto, pelo `id` ou pelo texto. O wizard mantém os outros
 * passos montados e ocultos, e o que é deles não conta.
 */
async function controlesVisiveis(page: Page): Promise<string[]> {
  return page
    .locator('.wiz-content')
    .locator(SELETOR_DE_CONTROLES)
    .evaluateAll(
      (controles, permitidos) =>
        controles
          .filter((controle) => controle.checkVisibility())
          .filter((controle) => !permitidos.includes((controle.textContent ?? '').trim()))
          .map((controle) => controle.id || controle.textContent?.trim() || controle.tagName),
      BOTOES_DE_LEITURA,
    );
}

/**
 * Campos de texto e seletores do passo aberto cujo valor passa da largura do campo e que não o
 * repetem em `title`. O select vale pelo rótulo da opção escolhida, não pelo `value`.
 */
async function camposCortadosSemTitle(page: Page): Promise<string[]> {
  return page
    .locator('.wiz-content')
    .locator(
      'input.input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=date]):not([type=datetime-local]):not([type=time]), select.input, textarea.input',
    )
    .evaluateAll((campos) =>
      campos
        .filter((campo) => campo.checkVisibility())
        .map((campo) => {
          const texto =
            campo instanceof HTMLSelectElement
              ? (campo.selectedOptions[0]?.textContent ?? '').trim()
              : (campo as HTMLInputElement | HTMLTextAreaElement).value;
          return { campo, texto };
        })
        .filter(({ campo, texto }) => texto !== '' && campo.scrollWidth > campo.clientWidth)
        .filter(({ campo, texto }) => campo.getAttribute('title') !== texto)
        .map(({ campo, texto }) => `${campo.id || campo.tagName}: ${texto.slice(0, 60)}`),
    );
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
    await page.locator('.wiz-nav').getByRole('button', { name: rotulo }).click();
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
 * O processo, o ato publicado e os catálogos que os passos leem. Toda outra consulta à API
 * responde vazia: os passos também carregam catálogos ao abrir o processo, e sem a API no CI
 * eles falhariam por conexão recusada.
 *
 * A rota genérica é registrada primeiro porque o Playwright consulta as rotas da mais
 * recente para a mais antiga.
 */
async function mockarApi(page: Page, status: Status): Promise<void> {
  await responder(page, /\/api\//, []);
  await responder(page, /\/api\/configuracao\/tipos-processo(\?.*)?$/, TIPOS_DE_PROCESSO);
  await responder(page, /\/api\/configuracao\/fases-canonicas(\?.*)?$/, FASES_CANONICAS);
  await responder(page, /\/api\/selecao\/fundamentos-isencao(\?.*)?$/, FUNDAMENTOS_DE_ISENCAO);
  await responder(page, new RegExp(`/api/publicacoes/atos/${ATO_PUBLICADO.id}$`), ATO_PUBLICADO);

  const processo = new RegExp(`/api/selecao/processos-seletivos/${ID_DO_PROCESSO_COMPLETO}`);
  await page.route(processo, async (route: Route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    const caminho = new URL(request.url()).pathname;
    if (caminho.endsWith(ID_DO_PROCESSO_COMPLETO)) {
      await responderCom(route, { ...PROCESSO_PUBLICADO_COMPLETO, status });
    } else if (caminho.endsWith('/documentos-edital')) {
      await responderCom(route, [DOCUMENTO_DO_EDITAL]);
    } else if (caminho.endsWith('/snapshot-vigente')) {
      await responderCom(route, SNAPSHOT_VIGENTE);
    } else if (caminho.endsWith('/conformidade-legal')) {
      await responderCom(route, {
        processoSeletivoId: ID_DO_PROCESSO_COMPLETO,
        dataReferencia: '2027-01-01',
        regras: [],
        avisos: [],
      });
    } else if (caminho.endsWith('/conformidade')) {
      await responderCom(route, { processoSeletivoId: ID_DO_PROCESSO_COMPLETO, itens: [] });
    } else {
      await route.fulfill({ status: 404, headers: CORS_HEADERS });
    }
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
