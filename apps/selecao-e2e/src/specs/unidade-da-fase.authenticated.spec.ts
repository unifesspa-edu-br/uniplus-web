import { expect, test, type Page, type Route } from '@playwright/test';
import { mockPermissoesEfetivas, runAxeWcagAA } from '@uniplus/shared-e2e';
import { TIPOS_DE_PROCESSO } from '../fixtures/consulta-da-medicina';
import {
  ATO_DO_PROCESSO,
  ATO_PUBLICADO,
  DOCUMENTO_DO_EDITAL,
  FASES_CANONICAS,
  ID_DO_PROCESSO_COMPLETO,
  PROCESSO_PUBLICADO_COMPLETO,
  SNAPSHOT_VIGENTE,
  UNIDADE_RESPONSAVEL_DA_FASE,
} from '../fixtures/processo-publicado-completo';
import { PERMISSOES_DO_LEANDRO } from '../support/permissoes';
import { responder, responderCom } from '../support/responder';

/**
 * A unidade que responde por cada fase do cronograma, de ponta a ponta na tela: escolher a
 * unidade, publicar com a fase sem unidade, ser levado até a fase, corrigir e publicar.
 *
 * O CI do frontend sobe Keycloak, mas não a API: o processo, os catálogos e as gravações são
 * servidos por rota, e o `PUT /cronograma-fases` e o `POST /publicacao` são capturados para
 * conferir o comando que a tela monta — o contrato de verdade entre as duas pontas.
 */

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, PUT, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, accept, content-type, idempotency-key, if-match',
};

const PROBLEM_JSON = 'application/problem+json';

const UNIDADE_CEPS = {
  id: UNIDADE_RESPONSAVEL_DA_FASE.origemId,
  nome: UNIDADE_RESPONSAVEL_DA_FASE.nome,
  alias: null,
  slug: 'ceps',
  sigla: 'CEPS',
  codigo: 'CEPS',
  unidadeSuperiorId: null,
  tipo: 'PROREITORIA',
  unidadeAcademica: false,
  vigenciaInicio: '2020-01-01',
  vigenciaFim: null,
  criadoEm: '2020-01-01T00:00:00Z',
  cidadeCodigoIbge: null,
  cidadeNome: null,
  cidadeUf: null,
};

const UNIDADE_CGA = {
  ...UNIDADE_CEPS,
  id: '01a0d640-0000-7000-8000-0000000000a4',
  nome: 'Centro de Gestão Acadêmica',
  slug: 'cga',
  sigla: 'CGA',
  codigo: 'CGA',
};

const TIPOS_DE_ATO = ['RESULTADO_PRELIMINAR', 'RESULTADO_FINAL'].map((codigo, i) => ({
  id: `01a0d640-0000-7000-8000-0000000000b${i + 5}`,
  codigo,
  nome: codigo,
  congelaConfiguracao: false,
  unicoPorObjeto: false,
  efeitoIrreversivel: false,
  ehResultado: true,
  vigenciaInicio: '2020-01-01',
  vigenciaFim: null,
  baseLegal: null,
}));

const FATOS_DO_CANDIDATO = [
  ['MODALIDADE', 'Modalidade', 'TEXTO'],
  ['DATA_NASCIMENTO', 'Data de nascimento', 'DATA'],
  ['OPTOU_PELAS_COTAS_DA_LEI', 'Optou pelas cotas da Lei', 'BOOLEANO'],
].map(([codigo, nome, dominio], i) => ({
  id: `01a0d640-0000-7000-8000-0000000000f${i + 1}`,
  codigo,
  nome,
  descricao: null,
  dominio,
  origem: 'DECLARADO',
  cardinalidade: 'UNICO',
  valoresDominio: null,
  pontoResolucao: 'INSCRICAO',
  binding: 'CAMPO',
  valoresDominioDeclarados: null,
  fonteValores: null,
  ativo: true,
  formato: null,
  escopo: 'CANDIDATO',
}));

const ID_DA_ADMINISTRADORA = '01a07d6a-a0b2-7448-89a6-a2c7867a0e38';
const UNIDADE_ADMINISTRADORA = {
  ...UNIDADE_CEPS,
  id: ID_DA_ADMINISTRADORA,
  sigla: 'CEPS-ADM',
  slug: 'ceps-adm',
  codigo: 'CEPS-ADM',
};

const FASES_DO_CATALOGO = [
  ...FASES_CANONICAS,
  ...[
    [
      'HABILITACAO',
      'Habilitação',
      { origemId: UNIDADE_CGA.id, sigla: 'CGA', slug: 'cga', nome: UNIDADE_CGA.nome },
    ],
    ['MATRICULA', 'Matrícula', null],
  ].map(([codigo, nome, unidadeSugerida], i) => ({
    ...FASES_CANONICAS[0],
    id: `01a0d640-0000-7000-8000-0000000000e${i + 1}`,
    codigo,
    nome,
    unidadeSugerida,
    agrupaEtapas: false,
    coletaInscricao: false,
  })),
];

const ROTA_DO_PROCESSO = new RegExp(`/api/selecao/processos-seletivos/${ID_DO_PROCESSO_COMPLETO}`);

interface Capturado {
  readonly cronogramas: { unidadeResponsavelId: string | null }[][];
  readonly publicacoes: unknown[];
  fase: Record<string, unknown>;
  publicado: boolean;
  recusaDeUnidade: boolean;
}

function novoCapturado(unidadeDaFase: typeof UNIDADE_RESPONSAVEL_DA_FASE | null): Capturado {
  return {
    cronogramas: [],
    publicacoes: [],
    fase: {
      ...PROCESSO_PUBLICADO_COMPLETO.cronogramaFases[0],
      produtos: [
        ...PROCESSO_PUBLICADO_COMPLETO.cronogramaFases[0].produtos,
        {
          id: '01a0d640-0000-7000-8000-0000000000d2',
          atoCodigo: 'RESULTADO_FINAL',
          papel: 'DEFINITIVO',
        },
      ],
      unidadeResponsavel: unidadeDaFase,
    },
    publicado: false,
    recusaDeUnidade: false,
  };
}

function problema(status: number, code: string, title: string, errors?: unknown) {
  return {
    type: 'about:blank',
    title,
    status,
    code,
    traceId: '00000000000000000000000000000001',
    errors,
  };
}

async function mockarApi(page: Page, capturado: Capturado): Promise<void> {
  await responder(page, /\/api\//, [], CORS);
  await mockPermissoesEfetivas(page, PERMISSOES_DO_LEANDRO);
  await responder(page, /\/api\/configuracao\/tipos-processo(\?.*)?$/, TIPOS_DE_PROCESSO, CORS);
  await responder(page, /\/api\/configuracao\/fases-canonicas(\?.*)?$/, FASES_DO_CATALOGO, CORS);
  await responder(page, /\/api\/configuracao\/fatos-candidato(\?.*)?$/, FATOS_DO_CANDIDATO, CORS);
  await responder(page, /\/api\/publicacoes\/tipos-ato(\?.*)?$/, TIPOS_DE_ATO, CORS);
  await responder(
    page,
    /\/api\/organizacao\/unidades(\?.*)?$/,
    [UNIDADE_CEPS, UNIDADE_CGA, UNIDADE_ADMINISTRADORA],
    CORS,
  );
  await responder(
    page,
    new RegExp(`/api/publicacoes/atos/${ATO_PUBLICADO.id}$`),
    ATO_PUBLICADO,
    CORS,
  );

  await page.route(ROTA_DO_PROCESSO, async (route: Route) => {
    const request = route.request();
    const metodo = request.method();
    if (metodo === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }

    const caminho = new URL(request.url()).pathname;
    if (metodo !== 'GET') {
      await escrever(route, capturado, caminho);
      return;
    }

    if (caminho.endsWith(ID_DO_PROCESSO_COMPLETO)) {
      await responderCom(
        route,
        {
          ...PROCESSO_PUBLICADO_COMPLETO,
          status: capturado.publicado ? 'publicado' : 'rascunho',
          cronogramaFases: [capturado.fase],
          ofertaAtendimento: null,
          raizesExigencia: PROCESSO_PUBLICADO_COMPLETO.raizesExigencia.slice(0, 1),
          classificacao: { ...PROCESSO_PUBLICADO_COMPLETO.classificacao, regrasEliminacao: [] },
        },
        CORS,
      );
    } else if (caminho.endsWith('/documentos-a-publicar')) {
      await responderCom(route, [DOCUMENTO_DO_EDITAL], CORS);
    } else if (caminho.endsWith('/atos')) {
      await responderCom(route, [ATO_DO_PROCESSO], CORS);
    } else if (caminho.endsWith('/snapshot-vigente')) {
      await responderCom(route, SNAPSHOT_VIGENTE, CORS);
    } else if (caminho.endsWith('/conformidade-legal')) {
      await responderCom(
        route,
        {
          processoSeletivoId: ID_DO_PROCESSO_COMPLETO,
          dataReferencia: '2027-01-01',
          regras: [],
          avisos: [],
        },
        CORS,
      );
    } else if (caminho.endsWith('/conformidade')) {
      await responderCom(
        route,
        { processoSeletivoId: ID_DO_PROCESSO_COMPLETO, itens: [], avisos: [] },
        CORS,
      );
    } else {
      await route.fulfill({ status: 404, headers: CORS });
    }
  });
}

async function escrever(route: Route, capturado: Capturado, caminho: string): Promise<void> {
  const sem204 = { status: 204, headers: CORS };
  const corpo = route.request().postDataJSON();

  if (caminho.endsWith('/cronograma-fases')) {
    capturado.cronogramas.push(corpo);
    if (capturado.recusaDeUnidade) {
      await route.fulfill({
        status: 422,
        contentType: PROBLEM_JSON,
        headers: CORS,
        body: JSON.stringify(
          problema(422, 'uniplus.validacao', 'Validação', [
            {
              field: 'fases[0].unidadeResponsavelId',
              code: 'uniplus.selecao.fase_cronograma.unidade_responsavel_nao_encontrada',
              message: 'x',
            },
          ]),
        ),
      });
      return;
    }
    const [fase] = corpo as { unidadeResponsavelId: string | null }[];
    const escolhida = [UNIDADE_CEPS, UNIDADE_CGA].find(
      (unidade) => unidade.id === fase?.unidadeResponsavelId,
    );
    capturado.fase = {
      ...capturado.fase,
      unidadeResponsavel: escolhida
        ? {
            origemId: escolhida.id,
            sigla: escolhida.sigla,
            slug: escolhida.slug,
            nome: escolhida.nome,
          }
        : null,
    };
    await route.fulfill(sem204);
    return;
  }

  if (caminho.endsWith('/distribuicao-vagas/simulacao')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS,
      body: JSON.stringify(PROCESSO_PUBLICADO_COMPLETO.distribuicaoVagas),
    });
    return;
  }

  if (caminho.endsWith('/publicacao')) {
    capturado.publicacoes.push(corpo);
    if (capturado.fase['unidadeResponsavel'] === null) {
      await route.fulfill({
        status: 422,
        contentType: PROBLEM_JSON,
        headers: CORS,
        body: JSON.stringify(
          problema(
            422,
            'uniplus.selecao.processo_seletivo.fase_sem_unidade_responsavel',
            'A fase precisa de unidade responsável para publicar.',
          ),
        ),
      });
      return;
    }
    capturado.publicado = true;
  }
  await route.fulfill(sem204);
}

async function simularOQuadroDeVagas(page: Page): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Etapas do cadastro' })
    .getByRole('button', { name: 'Vagas' })
    .click();
  await page.getByRole('button', { name: 'Simular o quadro' }).click();
  await expect(page.getByRole('button', { name: 'Simular o quadro' })).toBeEnabled();
}

async function abrirOProcesso(page: Page): Promise<void> {
  await page.goto(`/processo-seletivo/${ID_DO_PROCESSO_COMPLETO}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

async function irAoCronograma(page: Page): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Etapas do cadastro' })
    .getByRole('button', { name: 'Cronograma' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: /^Passo 5:/ })).toBeVisible();
}

test.describe('Unidade responsável da fase no cronograma', () => {
  test('a escolha da unidade segue no comando de gravação do cronograma', async ({ page }) => {
    const capturado = novoCapturado(UNIDADE_RESPONSAVEL_DA_FASE);
    await mockarApi(page, capturado);
    await abrirOProcesso(page);
    await irAoCronograma(page);

    await page.locator('.fase-alternar').first().click();
    const unidade = page.getByLabel('Unidade responsável');
    await expect(unidade).toHaveValue(UNIDADE_CEPS.id);
    await unidade.selectOption({ label: 'CGA — Centro de Gestão Acadêmica' });

    await page.getByRole('button', { name: /Gravar e avançar/ }).click();
    await page
      .getByRole('button', { name: /Confirmar|Gravar/ })
      .last()
      .click();

    await expect.poll(() => capturado.cronogramas.length).toBeGreaterThan(0);
    expect(capturado.cronogramas.at(-1)?.[0]?.unidadeResponsavelId).toBe(UNIDADE_CGA.id);
  });

  test('a publicação recusada por fase sem unidade leva à fase, e corrigida publica', async ({
    page,
  }) => {
    const capturado = novoCapturado(null);
    await mockarApi(page, capturado);
    await abrirOProcesso(page);
    await simularOQuadroDeVagas(page);

    await page
      .getByRole('navigation', { name: 'Etapas do cadastro' })
      .getByRole('button', { name: 'Revisão e publicação' })
      .click();
    await page.getByLabel('Tipo de ato').selectOption({ index: 1 });
    await page.getByLabel('Órgão').fill('CEPS/Unifesspa');
    await page.getByLabel('Série').fill('Edital de abertura');
    await page.getByLabel('Ano').fill('2027');
    await page.getByLabel('Data de publicação do ato').fill('2027-01-15');
    await page.getByLabel('Assinante').fill('Reitor da Unifesspa');

    await page.getByRole('button', { name: 'Publicar', exact: true }).click();
    await page.getByRole('button', { name: 'Publicar processo' }).click();

    const aviso = page.getByText(
      'Toda fase do cronograma precisa de unidade responsável para publicar.',
    );
    await expect(aviso).toBeVisible();
    expect(await runAxeWcagAA(page).then((r) => r.violations.map((v) => v.id))).toEqual([]);

    await page.getByRole('button', { name: /Ir para a fase Inscrição/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: /^Passo 5:/ })).toBeVisible();
    const unidade = page.getByLabel('Unidade responsável');
    await expect(unidade).toBeFocused();
    await expect(page.getByText('Esta fase está sem unidade responsável.')).toBeVisible();
    await expect(unidade).toHaveAttribute('aria-invalid', 'true');

    await unidade.selectOption({ label: 'CGA — Centro de Gestão Acadêmica' });
    await page
      .getByRole('navigation', { name: 'Etapas do cadastro' })
      .getByRole('button', { name: 'Revisão e publicação' })
      .click();
    await page.getByRole('button', { name: 'Publicar', exact: true }).click();
    await page.getByRole('button', { name: 'Publicar processo' }).click();

    await expect.poll(() => capturado.publicado).toBe(true);
    expect(capturado.cronogramas.at(-1)?.[0]?.unidadeResponsavelId).toBe(UNIDADE_CGA.id);
  });

  test('a unidade recusada na gravação aparece no campo da fase', async ({ page }) => {
    const capturado = novoCapturado(UNIDADE_RESPONSAVEL_DA_FASE);
    capturado.recusaDeUnidade = true;
    await mockarApi(page, capturado);
    await abrirOProcesso(page);
    await irAoCronograma(page);

    await page.locator('.fase-alternar').first().click();
    await page.getByRole('button', { name: /Gravar e avançar/ }).click();

    const unidade = page.getByLabel('Unidade responsável');
    await expect(unidade).toHaveAttribute('aria-invalid', 'true');
    await expect(
      page.getByRole('alert').filter({ hasText: 'não está mais no cadastro' }),
    ).toBeVisible();
    expect(await runAxeWcagAA(page).then((r) => r.violations.map((v) => v.id))).toEqual([]);
  });

  test('em consulta, o cronograma lê a unidade gravada na fase', async ({ page }) => {
    const capturado = novoCapturado(UNIDADE_RESPONSAVEL_DA_FASE);
    capturado.publicado = true;
    await mockarApi(page, capturado);
    await abrirOProcesso(page);
    await irAoCronograma(page);

    await expect(page.getByText('CEPS — Centro de Processos Seletivos').first()).toBeVisible();
  });

  test('a fase acrescentada começa pela unidade sugerida, ou pela administradora sem sugestão', async ({
    page,
  }) => {
    await mockarApi(page, novoCapturado(UNIDADE_RESPONSAVEL_DA_FASE));
    await abrirOProcesso(page);
    await irAoCronograma(page);

    for (const [indice, fase, esperada] of [
      [1, 'Habilitação', UNIDADE_CGA.id],
      [2, 'Matrícula', ID_DA_ADMINISTRADORA],
    ] as const) {
      await page.getByLabel('Fase do catálogo').selectOption({ label: fase });
      await page.getByRole('button', { name: 'Acrescentar à linha do tempo' }).click();
      await page.getByRole('button', { name: `${indice + 1}. ${fase}`, exact: true }).click();
      await expect(page.locator(`#cr-unidade-${indice}`)).toHaveValue(esperada);
    }
  });
});
