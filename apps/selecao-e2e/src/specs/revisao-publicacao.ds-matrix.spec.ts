import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import type { AxeResults } from 'axe-core';

type DsTheme = 'light' | 'dark' | 'contrast';

/** Abaixo desta largura o stepper lateral dá lugar à barra com diálogo. */
const LARGURA_STEPPER_LATERAL = 768;

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, accept',
};

const PROCESSO_ID = '01960000-0000-7000-0000-000000000901';
const DOCUMENTO_ID = '01960000-0000-7000-0000-000000000902';

const TIPO_ATO_DTO = {
  id: '01960000-0000-7000-0000-000000000903',
  codigo: 'PORTARIA',
  nome: 'Portaria',
  congelaConfiguracao: true,
  unicoPorObjeto: false,
  efeitoIrreversivel: true,
  ehResultado: false,
  vigenciaInicio: '2020-01-01',
  vigenciaFim: null,
  baseLegal: null,
  criadoEm: '2020-01-01T00:00:00Z',
};

/** Fase com `coletaInscricao: true` — o período de inscrição some da tela e vem da janela dela. */
const FASE_DE_COLETA = {
  faseCanonicaOrigemId: '01960000-0000-7000-0000-000000000904',
  codigo: 'INSCRICAO',
  donoInstitucional: 'CEPS',
  origemData: 'DECLARADA',
  agrupaEtapas: false,
  coletaInscricao: true,
  bancasRequeridas: [],
  ordem: 1,
  inicio: '2027-01-01T00:00:00Z',
  fim: '2027-01-31T23:59:59Z',
  produtos: [],
  faseConcluinteCodigo: null,
  emiteParecerIndividual: false,
  regraRecurso: null,
};

interface MockarProcessoOpcoes {
  readonly cronogramaFases?: readonly unknown[];
  readonly conformidadeItens?: readonly { codigo: string; dimensao: string; mensagem: string; ok: boolean }[];
  readonly conformidadeLegalRegras?: readonly unknown[];
}

function processoDto(cronogramaFases: readonly unknown[]) {
  return {
    id: PROCESSO_ID,
    nome: 'Processo Seletivo de teste',
    tipoProcesso: { origemId: '01960000-0000-7000-0000-000000000905', codigo: 'GRAD', nome: 'Graduação' },
    // Vocabulário do wire é camelCase, não o nome do enum C# — status: 'Rascunho'
    // faria hidratar() marcar o processo como somente leitura (edicaoPermitida()
    // compara com StatusProcesso.rascunho === 'rascunho') e todo campo do
    // formulário nasceria desabilitado.
    status: 'rascunho',
    origemCandidatos: 'inscricaoPropria',
    unidadeAdministradora: {
      origemId: '01960000-0000-7000-0000-000000000906',
      sigla: 'CEPS',
      slug: 'ceps',
      nome: 'CEPS',
      tipo: 'PROREITORIA',
      cidadeCodigoIbge: '1500107',
      cidadeNome: 'Marabá',
      cidadeUf: 'PA',
    },
    localidade: { codigoIbge: '1500107', nome: 'Marabá', uf: 'PA' },
    etapas: [],
    ofertaAtendimento: null,
    distribuicaoVagas: [],
    bonusRegional: null,
    cascata: null,
    criteriosDesempate: [],
    classificacao: null,
    cronogramaFases,
    documentosExigidos: [],
    raizesExigencia: [],
    referenciaTemporalFatos: null,
    fatosColetados: [],
    regrasDerivacao: [],
    formularioTitulo: null,
    formularioTermoAceiteTexto: null,
    configuracaoDivulgacao: null,
    configuracaoTaxaInscricao: null,
    algoritmoContagemPrazo: null,
    criadoEm: '2027-01-01T00:00:00Z',
  };
}

/**
 * Um único `page.route` para o agregado Processo Seletivo — despacha pelo
 * final do caminho, porque o detalhe, os documentos e os dois checklists
 * moram todos sob o mesmo prefixo `/processos-seletivos/{id}`.
 */
async function mockarProcesso(page: Page, opcoes: MockarProcessoOpcoes = {}): Promise<void> {
  const cronogramaFases = opcoes.cronogramaFases ?? [FASE_DE_COLETA];
  const conformidadeItens = opcoes.conformidadeItens ?? [];
  const conformidadeLegalRegras = opcoes.conformidadeLegalRegras ?? [];

  await page.route(
    new RegExp(`/api/selecao/processos-seletivos/${PROCESSO_ID}(/.*)?(\\?.*)?$`),
    async (route: Route) => {
      const request = route.request();
      if (request.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: CORS_HEADERS });
        return;
      }

      const url = new URL(request.url());
      const caminho = url.pathname;

      if (caminho.endsWith('/documentos-edital')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: CORS_HEADERS,
          body: JSON.stringify([
            {
              id: DOCUMENTO_ID,
              processoSeletivoId: PROCESSO_ID,
              status: 'Confirmado',
              criadoEm: '2027-01-01T00:00:00Z',
              expiraEm: '2027-01-01T01:00:00Z',
              tamanhoBytes: 123456,
              hashSha256: 'a'.repeat(64),
              confirmadoEm: '2027-01-01T00:10:00Z',
            },
          ]),
        });
        return;
      }

      if (caminho.endsWith('/conformidade-legal')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: CORS_HEADERS,
          body: JSON.stringify({
            processoSeletivoId: PROCESSO_ID,
            dataReferencia: '2027-01-01',
            regras: conformidadeLegalRegras,
            avisos: [],
          }),
        });
        return;
      }

      if (caminho.endsWith('/conformidade')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: CORS_HEADERS,
          body: JSON.stringify({ processoSeletivoId: PROCESSO_ID, itens: conformidadeItens }),
        });
        return;
      }

      // O detalhe é a própria rota `/processos-seletivos/{id}`, sem sufixo.
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: CORS_HEADERS,
        body: JSON.stringify(processoDto(cronogramaFases)),
      });
    },
  );
}

async function mockarTiposAto(page: Page): Promise<void> {
  await page.route(/\/api\/publicacoes\/tipos-ato(\?.*)?$/, async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS_HEADERS,
      body: JSON.stringify([TIPO_ATO_DTO]),
    });
  });
}

/**
 * Matriz do Uni+ DS para o passo Revisão e Publicação (`#486`). O preflight —
 * checklist estrutural, conformidade legal, documento confirmado e tipo de
 * ato — só existe com um processo já criado, então a suíte entra pela rota de
 * retomada (`/processo-seletivo/{id}`) em vez de `/novo`, com o detalhe,
 * os documentos e os dois checklists mockados por rota.
 */
test.describe('Revisão e publicação — matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await mockarTiposAto(page);
    await instalarPreferencia(page, temaDoProject(testInfo.project.name));
  });

  test('não viola WCAG 2.1 AA com checklist estrutural e legal conformes', async ({
    page,
  }, testInfo) => {
    await mockarProcesso(page, { cronogramaFases: [FASE_DE_COLETA] });
    await page.goto(`/processo-seletivo/${PROCESSO_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await irAoPasso(page, 'Revisão e publicação', testInfo);

    await expect(page.getByRole('heading', { name: 'Checklist estrutural' })).toBeVisible();
    await expect(page.getByText('Nenhuma pendência estrutural.')).toBeVisible();
    await expect(page.getByText('Nenhuma obrigatoriedade legal reprovada.')).toBeVisible();
    // Com fase de coleta, o período não é pedido nesta tela.
    await expect(page.getByLabel('Início do período de inscrição')).toBeHidden();

    const resultado = await runAxeWcagAA(page);
    expect(identificadoresDe(resultado)).toEqual([]);
  });

  test('não viola WCAG 2.1 AA sem fase de coleta — período de inscrição pedido nesta tela', async ({
    page,
  }, testInfo) => {
    await mockarProcesso(page, { cronogramaFases: [] });
    await page.goto(`/processo-seletivo/${PROCESSO_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await irAoPasso(page, 'Revisão e publicação', testInfo);

    await expect(page.getByLabel('Início do período de inscrição')).toBeVisible();
    await page.getByLabel('Início do período de inscrição').fill('2027-05-01T08:00');
    await page.getByLabel('Fim do período de inscrição').fill('2027-05-10T18:00');
    await page.getByLabel('Número do ato (opcional)').fill('001/2027');
    await page.getByLabel('Tipo de ato').selectOption('PORTARIA');
    await page.getByLabel('Órgão').fill('Reitoria');
    await page.getByLabel('Série').fill('1');
    await page.getByLabel('Ano').fill('2027');
    await page.getByLabel('Data de publicação do ato').fill('2027-01-15');
    await page.getByLabel('Assinante').fill('Reitor');

    const resultado = await runAxeWcagAA(page);
    expect(identificadoresDe(resultado)).toEqual([]);
  });

  test('não viola WCAG 2.1 AA com pendências no checklist estrutural e legal', async ({
    page,
  }, testInfo) => {
    await mockarProcesso(page, {
      cronogramaFases: [FASE_DE_COLETA],
      conformidadeItens: [
        {
          codigo: 'taxa_inscricao_nao_declarada',
          dimensao: 'taxa_inscricao',
          mensagem: 'Declare se o processo cobra taxa de inscrição.',
          ok: false,
        },
        {
          codigo: 'classificacao_ausente',
          dimensao: 'classificacao',
          mensagem: 'Declare a classificação do processo.',
          ok: false,
        },
      ],
      conformidadeLegalRegras: [
        {
          regraId: '01960000-0000-7000-0000-000000000907',
          regraCodigo: 'OBRIG-COTAS-LEI-12711',
          categoria: 'OBRIGATORIA',
          tipoProcessoCodigoAvaliado: 'GRAD',
          predicado: 'SEMPRE',
          aprovada: false,
          motivo: 'O processo não declarou distribuição de vagas por cotas.',
          baseLegal: 'Lei 12.711/2012',
          atoNormativoUrl: null,
          portariaInterna: null,
          descricaoHumana: 'Reserva de vagas da Lei de Cotas',
          vigenciaInicio: '2012-08-30',
          vigenciaFim: null,
        },
      ],
    });
    await page.goto(`/processo-seletivo/${PROCESSO_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await irAoPasso(page, 'Revisão e publicação', testInfo);

    // Grupo pendente abre sozinho — o item fica visível sem clique algum.
    await expect(
      page.getByText('Declare se o processo cobra taxa de inscrição.'),
    ).toBeVisible();
    await expect(page.getByText('Reserva de vagas da Lei de Cotas')).toBeVisible();
    await expect(page.getByRole('button', { name: /Ir para Taxa inscricao/ })).toBeVisible();

    const resultado = await runAxeWcagAA(page);
    expect(identificadoresDe(resultado)).toEqual([]);
  });

  test('a frase de publicação simulada não existe mais', async ({ page }, testInfo) => {
    await mockarProcesso(page, { cronogramaFases: [FASE_DE_COLETA] });
    await page.goto(`/processo-seletivo/${PROCESSO_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await irAoPasso(page, 'Revisão e publicação', testInfo);

    await expect(
      page.getByText(
        'A publicação será habilitada quando a integração com a API estiver disponível.',
      ),
    ).toHaveCount(0);
  });

  test('não transborda horizontalmente', async ({ page }, testInfo) => {
    await mockarProcesso(page, { cronogramaFases: [FASE_DE_COLETA] });
    await page.goto(`/processo-seletivo/${PROCESSO_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await irAoPasso(page, 'Revisão e publicação', testInfo);

    const medida = await page.evaluate(() => {
      const documento = document.documentElement;
      const scroller = document.querySelector('.wiz-content');
      return {
        documento: documento.scrollWidth - documento.clientWidth,
        scroller: scroller instanceof HTMLElement ? scroller.scrollWidth - scroller.clientWidth : 0,
      };
    });

    expect(medida.documento).toBeLessThanOrEqual(1);
    expect(medida.scroller).toBeLessThanOrEqual(1);
  });
});

/**
 * Abaixo de 768 px o stepper lateral dá lugar à barra de etapas com diálogo, e
 * o caminho até um passo muda com ele.
 */
async function irAoPasso(page: Page, rotulo: string, testInfo: TestInfo): Promise<void> {
  const largura = testInfo.project.use.viewport?.width;
  if (largura === undefined) {
    throw new Error(`Project ${testInfo.project.name} não declara viewport.`);
  }

  if (largura >= LARGURA_STEPPER_LATERAL) {
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
