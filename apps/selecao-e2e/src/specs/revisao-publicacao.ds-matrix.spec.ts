import { expect, test, type Page, type Route } from '@playwright/test';
import { mockPermissoesEfetivas, runAxeWcagAA } from '@uniplus/shared-e2e';
import type { AxeResults } from 'axe-core';
import {
  conferirRolagemPorRodaForaDoConteudo,
  conferirRolagemPorTeclado,
  conferirStepperNaAlturaDaArea,
  encurtarJanela,
  medirTransbordoHorizontal,
  rolarAteOMeio,
} from '../support/rolagem-do-editor';
import { irAoPasso } from '../support/navega-passo';
import { instalarPreferencia, temaDoProject } from '../support/tema';
import { PERMISSOES_DO_LEANDRO } from '../support/permissoes';

test.beforeEach(async ({ page }) => {
  await mockPermissoesEfetivas(page, PERMISSOES_DO_LEANDRO);
});

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, accept',
};

const PROCESSO_ID = '01960000-0000-7000-0000-000000000901';
const DOCUMENTO_ID = '01960000-0000-7000-0000-000000000902';
const ATO_ID = '01960000-0000-7000-0000-000000000908';

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

const ATO_DTO = {
  id: ATO_ID,
  orgao: 'CEPS/Unifesspa',
  serie: 'Edital de abertura',
  ano: 2027,
  numero: '001/2027',
  tipoCodigo: TIPO_ATO_DTO.codigo,
  congelaConfiguracao: true,
  efeitoIrreversivel: true,
  unicoPorObjeto: false,
  dataPublicacao: '2027-01-15',
  documentoHash: 'b'.repeat(64),
  assinante: 'Reitor da Unifesspa',
  registradoEm: '2027-01-15T12:00:00Z',
  versaoInvocadaId: null,
  versaoInvocadaHash: null,
  atoRetificadoId: null,
  motivoRetificacao: null,
  avisos: null,
  _links: null,
};

const ANEXO_A = '01960000-0000-7000-0000-00000000090a';
const ANEXO_B = '01960000-0000-7000-0000-00000000090b';

/** O rascunho da publicação guarda os anexos já confirmados, pelo documento e pelo nome de exibição. */
const RASCUNHO_COM_ANEXOS = {
  versao: 1,
  salvoEm: '2027-01-10T12:00:00Z',
  conteudo: {
    numero: '',
    periodoInscricaoInicio: '',
    periodoInscricaoFim: '',
    ato: {},
    anexos: [
      { documentoId: ANEXO_A, nome: 'Cronograma detalhado', nomeArquivo: 'cronograma.pdf' },
      { documentoId: ANEXO_B, nome: 'Modelo de recurso', nomeArquivo: 'modelo-de-recurso.docx' },
    ],
  },
};

function atoDoProcesso() {
  const documento = (id: string, nomeArquivo: string, nomeDeExibicao: string | null) => ({
    documentoAPublicarId: id,
    nomeArquivo,
    nomeDeExibicao,
    tipoDeMidia: 'application/pdf',
    hashSha256: 'e'.repeat(64),
  });
  return {
    id: ATO_ID,
    tipoCodigo: TIPO_ATO_DTO.codigo,
    tipoNome: 'Portaria',
    numero: '001/2027',
    dataDoAto: '2027-01-15',
    publicadoEm: '2027-01-15T12:00:00Z',
    assinante: 'Reitor da Unifesspa',
    situacao: 'registrado',
    registradoEm: '2027-01-15T12:00:00Z',
    pendenciaAcimaDoLimiar: false,
    atoCorrigidoId: null,
    motivoDaCorrecao: null,
    politicaDeDivulgacaoConfirmada: false,
    documentoPrincipal: documento(DOCUMENTO_ID, 'edital.pdf', null),
    anexos: [
      documento(ANEXO_A, 'cronograma.pdf', 'Cronograma detalhado.pdf'),
      documento(ANEXO_B, 'modelo-de-recurso.pdf', null),
    ],
  };
}

interface MockarProcessoOpcoes {
  readonly rascunhoDaPublicacao?: unknown;
  readonly status?: 'rascunho' | 'publicado';
  readonly cronogramaFases?: readonly unknown[];
  readonly conformidadeItens?: readonly { codigo: string; dimensao: string; mensagem: string; ok: boolean }[];
  readonly conformidadeAvisos?: readonly { codigo: string; dimensao: string; mensagem: string }[];
  readonly conformidadeLegalRegras?: readonly unknown[];
}

function processoDto(cronogramaFases: readonly unknown[], status: string) {
  return {
    id: PROCESSO_ID,
    nome: 'Processo Seletivo de teste',
    tipoProcesso: { origemId: '01960000-0000-7000-0000-000000000905', codigo: 'GRAD', nome: 'Graduação' },
    // Vocabulário do wire é camelCase, não o nome do enum C# — status: 'Rascunho'
    // faria hidratar() marcar o processo como somente leitura (edicaoPermitida()
    // compara com StatusProcesso.rascunho === 'rascunho') e todo campo do
    // formulário nasceria desabilitado.
    status,
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
    aplicaBonusRegional: false,
    cascata: null,
    criteriosDesempate: [],
    classificacao: null,
    cronogramaFases,
    documentosExigidos: [],
    raizesExigencia: [],
    referenciaTemporalFatos: null,
    regrasDerivacao: [],
    formularios: [],
    opcoesDeclaradas: [],
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
  const conformidadeAvisos = opcoes.conformidadeAvisos ?? [];
  const conformidadeLegalRegras = opcoes.conformidadeLegalRegras ?? [];
  const status = opcoes.status ?? 'rascunho';

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

      if (caminho.endsWith('/documentos-a-publicar')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: CORS_HEADERS,
          body: JSON.stringify([
            {
              id: DOCUMENTO_ID,
              processoSeletivoId: PROCESSO_ID,
              finalidade: 'documentoDoEdital',
              nomeArquivo: 'edital.pdf',
              tipoDeMidia: 'application/pdf',
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

      if (caminho.endsWith('/snapshot-vigente')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: CORS_HEADERS,
          body: JSON.stringify({
            snapshotPublicacaoId: '01960000-0000-7000-0000-000000000909',
            atoId: ATO_ID,
            schemaVersion: '1',
            algoritmoHash: 'c'.repeat(64),
            hashConfiguracao: 'd'.repeat(64),
            hashEdital: 'a'.repeat(64),
            configuracao: {},
          }),
        });
        return;
      }

      if (caminho.endsWith('/atos')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: CORS_HEADERS,
          body: JSON.stringify([atoDoProcesso()]),
        });
        return;
      }

      if (caminho.endsWith('/rascunho-da-publicacao')) {
        if (opcoes.rascunhoDaPublicacao === undefined) {
          await route.fulfill({ status: 404, headers: CORS_HEADERS });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: CORS_HEADERS,
          body: JSON.stringify(opcoes.rascunhoDaPublicacao),
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
          body: JSON.stringify({
            processoSeletivoId: PROCESSO_ID,
            itens: conformidadeItens,
            avisos: conformidadeAvisos,
          }),
        });
        return;
      }

      // O detalhe é a própria rota `/processos-seletivos/{id}`, sem sufixo.
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: CORS_HEADERS,
        body: JSON.stringify(processoDto(cronogramaFases, status)),
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

async function mockarAtoPublicado(page: Page): Promise<void> {
  await page.route(new RegExp(`/api/publicacoes/atos/${ATO_ID}$`), async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS_HEADERS,
      body: JSON.stringify(ATO_DTO),
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
    await expect(page.getByLabel('Início do período de inscrição', { exact: true })).toBeHidden();

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

    await expect(page.getByLabel('Início do período de inscrição', { exact: true })).toBeVisible();
    await page.getByLabel('Início do período de inscrição', { exact: true }).fill('2027-05-01T08:00');
    await page.getByLabel('Fim do período de inscrição', { exact: true }).fill('2027-05-10T18:00');
    await page.getByLabel('Número do ato (opcional)', { exact: true }).fill('001/2027');
    await page.getByLabel('Tipo de ato', { exact: true }).selectOption('PORTARIA');
    await page.getByLabel('Órgão', { exact: true }).fill('Reitoria');
    await page.getByLabel('Série', { exact: true }).fill('1');
    await page.getByLabel('Ano', { exact: true }).fill('2027');
    await page.getByLabel('Data de publicação do ato', { exact: true }).fill('2027-01-15');
    await page.getByLabel('Assinante', { exact: true }).fill('Reitor');

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
    // Ancorado em `.revisao-list` (não `page` inteira): todos os passos do
    // wizard ficam montados (`[hidden]`), e o passo Pagamento tem um
    // subtítulo estático com a MESMA frase que este item de pendência —
    // coincidência de domínio (o texto do checklist espelha o da tela),
    // não colisão de teste. `getByText` alcança elemento oculto por padrão,
    // então sem ancorar o teste bateria em dois elementos.
    await expect(
      page.locator('.revisao-list').getByText('Declare se o processo cobra taxa de inscrição.'),
    ).toBeVisible();
    await expect(page.getByText('Reserva de vagas da Lei de Cotas')).toBeVisible();
    // O botão nomeia o PASSO, não a dimensão: com a decisão por item, dois itens da mesma
    // dimensão podem levar a passos diferentes, e "Taxa inscricao" era a grafia mecânica do
    // código da dimensão, não o nome que o operador vê no stepper.
    await expect(page.getByRole('button', { name: /Ir para Taxa de inscrição/ })).toBeVisible();

    const resultado = await runAxeWcagAA(page);
    expect(identificadoresDe(resultado)).toEqual([]);
  });

  test('não viola WCAG 2.1 AA com aviso de conformidade e checklist conforme', async ({
    page,
  }, testInfo) => {
    await mockarProcesso(page, {
      cronogramaFases: [FASE_DE_COLETA],
      conformidadeAvisos: [
        {
          codigo: 'cronograma_tipo_definitivo_em_mais_de_um_lugar',
          dimensao: 'cronograma',
          mensagem:
            'O mesmo tipo de ato definitivo foi declarado em mais de uma fase. Confirme que o edital quer isso.',
        },
      ],
    });
    await page.goto(`/processo-seletivo/${PROCESSO_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await irAoPasso(page, 'Revisão e publicação', testInfo);

    await expect(page.getByRole('heading', { name: 'Avisos para conferir' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Ir para Cronograma/ })).toBeVisible();

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

    const medida = await medirTransbordo(page);

    expect(medida.documento).toBeLessThanOrEqual(1);
    expect(medida.scroller).toBeLessThanOrEqual(1);
  });

  test('em consulta, mostra o ato publicado como texto sem violar WCAG 2.1 AA nem transbordar', async ({
    page,
  }, testInfo) => {
    await mockarAtoPublicado(page);
    await mockarProcesso(page, { status: 'publicado', cronogramaFases: [FASE_DE_COLETA] });
    await page.goto(`/processo-seletivo/${PROCESSO_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await irAoPasso(page, 'Revisão e publicação', testInfo);

    const ato = page.getByRole('definition').filter({ hasText: '001/2027' });
    await expect(ato).toBeVisible();
    await expect(page.getByText('Reitor da Unifesspa')).toBeVisible();
    await expect(page.getByText('15/01/2027')).toBeVisible();
    await expect(page.getByLabel('Número do ato (opcional)', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Salvar rascunho' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Publicar' })).toHaveCount(0);

    const resultado = await runAxeWcagAA(page);
    expect(identificadoresDe(resultado)).toEqual([]);

    const medida = await medirTransbordo(page);

    expect(medida.documento).toBeLessThanOrEqual(1);
    expect(medida.scroller).toBeLessThanOrEqual(1);
  });

  test('com anexos no rascunho, lista o nome de cada um e não viola WCAG 2.1 AA nem transborda', async ({
    page,
  }, testInfo) => {
    await mockarProcesso(page, {
      cronogramaFases: [FASE_DE_COLETA],
      rascunhoDaPublicacao: RASCUNHO_COM_ANEXOS,
    });
    await page.goto(`/processo-seletivo/${PROCESSO_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await irAoPasso(page, 'Revisão e publicação', testInfo);

    const nome = page.getByLabel('Nome do anexo cronograma.pdf', { exact: true });
    await expect(nome).toHaveValue('Cronograma detalhado');
    await expect(
      page.getByLabel('Nome do anexo modelo-de-recurso.docx', { exact: true }),
    ).toHaveValue('Modelo de recurso');

    // O nome que o download não aceitaria é dito no campo, ligado a ele para o leitor de tela.
    await nome.fill('pasta/cronograma');
    await expect(nome).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText(/O nome do anexo não pode ter/)).toBeVisible();
    await nome.fill('Cronograma detalhado');
    await expect(nome).not.toHaveAttribute('aria-invalid', 'true');

    const resultado = await runAxeWcagAA(page);
    expect(identificadoresDe(resultado)).toEqual([]);

    const medida = await medirTransbordo(page);
    expect(medida.documento).toBeLessThanOrEqual(1);
    expect(medida.scroller).toBeLessThanOrEqual(1);
  });

  test('em consulta, mostra como texto os anexos que a versão vigente publicou', async ({
    page,
  }, testInfo) => {
    await mockarAtoPublicado(page);
    await mockarProcesso(page, { status: 'publicado', cronogramaFases: [FASE_DE_COLETA] });
    await page.goto(`/processo-seletivo/${PROCESSO_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await irAoPasso(page, 'Revisão e publicação', testInfo);

    const anexos = page.locator('sel-anexos-do-edital');
    await expect(anexos.getByText('Cronograma detalhado.pdf')).toBeVisible();
    await expect(anexos.getByText('modelo-de-recurso.pdf', { exact: false }).first()).toBeVisible();
    await expect(anexos.getByRole('textbox')).toHaveCount(0);
    await expect(anexos.getByRole('button', { name: /Abrir o anexo Cronograma detalhado/ })).toBeVisible();

    const resultado = await runAxeWcagAA(page);
    expect(identificadoresDe(resultado)).toEqual([]);

    const medida = await medirTransbordo(page);
    expect(medida.documento).toBeLessThanOrEqual(1);
    expect(medida.scroller).toBeLessThanOrEqual(1);
  });

  test('em consulta, rola a área de trabalho pelo teclado e pela roda fora do conteúdo do passo', async ({
    page,
  }, testInfo) => {
    await mockarAtoPublicado(page);
    await mockarProcesso(page, { status: 'publicado', cronogramaFases: [FASE_DE_COLETA] });
    await page.goto(`/processo-seletivo/${PROCESSO_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // O passo que abre sozinho cabe na janela encurtada; o ato publicado é o que passa dela.
    await irAoPasso(page, 'Revisão e publicação', testInfo);
    await encurtarJanela(page);

    await conferirRolagemPorTeclado(page);
    await conferirRolagemPorRodaForaDoConteudo(page);

    await rolarAteOMeio(page);
    await conferirStepperNaAlturaDaArea(page);
    const resultado = await runAxeWcagAA(page);
    expect(identificadoresDe(resultado)).toEqual([]);
    const transbordo = await medirTransbordoHorizontal(page);
    expect(transbordo.documento).toBeLessThanOrEqual(1);
    expect(transbordo.areaDeTrabalho).toBeLessThanOrEqual(1);
  });
});

/** Quanto a página e o conteúdo do passo rolam na horizontal, em px. */
async function medirTransbordo(page: Page): Promise<{ documento: number; scroller: number }> {
  return page.evaluate(() => {
    const documento = document.documentElement;
    const scroller = document.querySelector('.wiz-content');
    return {
      documento: documento.scrollWidth - documento.clientWidth,
      scroller: scroller instanceof HTMLElement ? scroller.scrollWidth - scroller.clientWidth : 0,
    };
  });
}

/** Falhar por id diz qual regra caiu; a coleção crua não. */
function identificadoresDe(resultado: AxeResults): string[] {
  return resultado.violations.map((violacao) => violacao.id);
}
