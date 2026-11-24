import { expect, test, type Page, type Request, type Route } from '@playwright/test';
import type { FatoDoCatalogoDto, ModeloFormularioView } from '@uniplus/shared-data/configuracao';
import type { JsonDaApi } from '@uniplus/shared-e2e';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const ID_DO_MODELO = '01960000-0000-7000-0000-0000000000a1';
const ROTULO_DA_ESCOLA = 'Estudou em escola pública?';
const TITULO_DO_CAMPO = /Estudou em escola pública/;
const AJUDA_DA_ESCOLA = 'Marque se todo o ensino médio foi cursado em escola pública.';
const OBRIGATORIEDADE_SEMPRE = { tipo: 'SEMPRE', predicado: null };
const REGRAS_DO_CAMPO = {
  exibicao: null,
  obrigatoriedade: OBRIGATORIEDADE_SEMPRE,
  restricoes: [],
  impedimento: null,
};

/** O modelo como a API o devolve: campo com apresentação e regras agrupadas, e grupo com ocorrências. */
const MODELO: JsonDaApi<ModeloFormularioView> = {
  id: ID_DO_MODELO,
  codigo: 'INSCRICAO',
  finalidade: { codigo: 'INSCRICAO', rotulo: 'Inscrição' },
  ativo: true,
  descritivo: { nome: 'Inscrição', descricao: null, tipoProcessoCodigo: null },
  conteudo: {
    titulo: 'Inscrição',
    etapas: [
      {
        codigo: 'SECAO_1',
        ordem: 0,
        tipo: 'SECAO',
        bloco: null,
        apresentacao: { titulo: 'Escolaridade', descricao: null, aviso: null },
        exibicao: null,
      },
    ],
    itens: [
      {
        fatoCodigo: 'NOME',
        ordem: 0,
        etapaCodigo: 'SECAO_1',
        apresentacao: {
          rotulo: 'Nome',
          tipoRenderizacao: 'TEXTO',
          ajuda: null,
          pedirConfirmacao: false,
        },
        regras: REGRAS_DO_CAMPO,
      },
      {
        fatoCodigo: 'ESCOLA_PUBLICA',
        ordem: 1,
        etapaCodigo: 'SECAO_1',
        apresentacao: {
          rotulo: ROTULO_DA_ESCOLA,
          tipoRenderizacao: 'SIM_OU_NAO',
          ajuda: AJUDA_DA_ESCOLA,
          pedirConfirmacao: false,
        },
        regras: REGRAS_DO_CAMPO,
      },
    ],
    termos: [],
    pressupostos: [],
    grupos: [
      {
        codigo: 'FAMILIA',
        ordem: 2,
        rotulo: 'Composição familiar',
        etapaCodigo: 'SECAO_1',
        ocorrencias: { minimo: 1, maximo: 4, incluiCandidato: true },
        regras: { exibicao: null, obrigatoriedade: OBRIGATORIEDADE_SEMPRE },
        subitens: [],
      },
    ],
    documentosExigidos: [],
  },
};

/** O texto não é citável em regra: a API devolve a lista de operadores vazia. */
function fatoDoCatalogo(codigo: string): JsonDaApi<FatoDoCatalogoDto> {
  const texto = codigo === 'NOME';
  return {
    fato: {
      id: codigo,
      codigo,
      nome: codigo,
      descricao: 'Dado do candidato.',
      dominio: texto
        ? { codigo: 'TEXTO', rotulo: 'Texto' }
        : { codigo: 'SIM_OU_NAO', rotulo: 'Sim ou não' },
      origem: { codigo: 'DECLARADO', rotulo: 'Declarado' },
      cardinalidade: { codigo: 'VALOR_UNICO', rotulo: 'Um valor' },
      valoresDominio: null,
      pontoResolucao: 'INSCRICAO',
      binding: `CAMPO_FORMULARIO:${codigo}`,
      valoresDominioDeclarados: null,
      fonteValores: null,
      ativo: true,
      classificacaoProtecao: 'INTERNO',
      hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
      finalidadeTratamento: 'Aplicar a regra do certame.',
      protecaoAprovada: true,
      escopo: 'CANDIDATO',
    },
    operadoresAdmitidos: texto
      ? []
      : [
          { codigo: 'IGUAL', rotulo: 'é' },
          { codigo: 'DIFERENTE', rotulo: 'não é' },
        ],
  };
}

const RECUSA_DO_ROTULO = 'O rótulo passou do tamanho.';
const RECUSA_DAS_OCORRENCIAS = 'O mínimo de ocorrências passou do máximo.';

interface Gravacoes {
  readonly corpos: unknown[];
}

function recusa422(erros: readonly { field: string; message: string }[]) {
  return {
    type: 'about:blank',
    title: 'Requisição inválida',
    status: 422,
    code: 'uniplus.configuracao.modelo_formulario.conteudo_invalido',
    errors: erros.map((erro) => ({ ...erro, code: 'uniplus.validacao' })),
  };
}

async function responderJson(route: Route, status: number, corpo: unknown): Promise<void> {
  const problema = status >= 400;
  await route.fulfill({
    status,
    headers: CORS_HEADERS,
    contentType: problema ? 'application/problem+json' : 'application/json',
    body: JSON.stringify(corpo),
  });
}

async function atenderModelo(route: Route, gravacoes: Gravacoes, recusa: object | null) {
  const pedido: Request = route.request();
  if (pedido.method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
  } else if (pedido.method() === 'PUT') {
    gravacoes.corpos.push(pedido.postDataJSON());
    await (recusa === null
      ? route.fulfill({ status: 204, headers: CORS_HEADERS })
      : responderJson(route, 422, recusa));
  } else {
    await responderJson(route, 200, MODELO);
  }
}

/** Os catálogos que o editor lê ao abrir, o modelo e o que o PUT recebeu; `recusa` faz o PUT falhar. */
async function mockarApi(page: Page, recusa: object | null = null): Promise<Gravacoes> {
  const gravacoes: Gravacoes = { corpos: [] };
  await page.route(
    /\/api\/configuracao\/(tipos-processo|fases-canonicas|tipos-documento|termos-consentimento)(\?.*)?$/,
    (route) => responderJson(route, 200, []),
  );
  await page.route(/\/api\/configuracao\/fatos-candidato(\?.*)?$/, (route) =>
    responderJson(route, 200, ['NOME', 'ESCOLA_PUBLICA'].map(fatoDoCatalogo)),
  );
  await page.route(/\/api\/configuracao\/admin\/modelos-formulario\/[^/?]+$/, (route) =>
    atenderModelo(route, gravacoes, recusa),
  );
  return gravacoes;
}

async function abrirModelo(page: Page): Promise<void> {
  await page.goto(`/modelos-formulario/${ID_DO_MODELO}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('article', { name: TITULO_DO_CAMPO })).toBeVisible();
}

async function salvarModelo(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Salvar modelo' }).click();
}

test.describe('Modelo de formulário — conteúdo na forma do contrato', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('mostra o rótulo e a ajuda que a API entrega na apresentação do campo', async ({ page }) => {
    await mockarApi(page);

    await abrirModelo(page);

    const campo = page.getByRole('article', { name: TITULO_DO_CAMPO });
    await expect(campo.getByLabel('Rótulo')).toHaveValue(ROTULO_DA_ESCOLA);
    await expect(campo.getByLabel('Ajuda')).toHaveValue(AJUDA_DA_ESCOLA);
  });

  test('o conteúdo lido e não editado volta à API agrupado, sem campos soltos', async ({
    page,
  }) => {
    const gravacoes = await mockarApi(page);
    await abrirModelo(page);

    await salvarModelo(page);

    await expect.poll(() => gravacoes.corpos.length).toBe(1);
    const { conteudo } = gravacoes.corpos[0] as {
      conteudo: JsonDaApi<ModeloFormularioView>['conteudo'];
    };
    expect(conteudo.itens?.[1]).toMatchObject({
      fatoCodigo: 'ESCOLA_PUBLICA',
      apresentacao: { rotulo: ROTULO_DA_ESCOLA, ajuda: AJUDA_DA_ESCOLA },
      regras: { obrigatoriedade: OBRIGATORIEDADE_SEMPRE },
    });
    expect(conteudo.itens?.[1]).not.toHaveProperty('rotulo');
    expect(conteudo.itens?.[1]).not.toHaveProperty('obrigatoriedade');
    expect(conteudo.grupos?.[0]?.ocorrencias).toMatchObject({
      minimo: 1,
      maximo: 4,
      incluiCandidato: true,
    });
    expect(conteudo.etapas?.[0]?.apresentacao).toMatchObject({ titulo: 'Escolaridade' });
  });

  test('a recusa do rótulo aninhado aparece junto do campo e não no resumo', async ({ page }) => {
    await mockarApi(
      page,
      recusa422([{ field: 'conteudo.itens[1].apresentacao.rotulo', message: RECUSA_DO_ROTULO }]),
    );
    await abrirModelo(page);

    await salvarModelo(page);

    const campo = page.getByRole('article', { name: TITULO_DO_CAMPO });
    await expect(campo.getByText(RECUSA_DO_ROTULO)).toBeVisible();
    await expect(page.locator('#cfg-modelo-resumo').getByText(RECUSA_DO_ROTULO)).toHaveCount(0);
    await expect(page.locator('#cfg-modelo-resumo')).toBeFocused();
  });

  test('a recusa das ocorrências do grupo aparece na página, fora do campo vizinho', async ({
    page,
  }) => {
    await mockarApi(
      page,
      recusa422([
        { field: 'conteudo.grupos[0].ocorrencias.minimo', message: RECUSA_DAS_OCORRENCIAS },
      ]),
    );
    await abrirModelo(page);

    await salvarModelo(page);

    await expect(page.getByText(RECUSA_DAS_OCORRENCIAS)).toBeVisible();
    const campo = page.getByRole('article', { name: TITULO_DO_CAMPO });
    await expect(campo.getByText(RECUSA_DAS_OCORRENCIAS)).toHaveCount(0);
  });
});
