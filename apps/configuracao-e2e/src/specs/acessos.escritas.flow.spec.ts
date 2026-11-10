import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { mockPermissoesEfetivas } from '@uniplus/shared-e2e';
import { mockApiDeAcesso, pedidoSeed } from '../support/api-de-acesso';
import { PERMISSOES_DO_DIOGO } from '../support/permissoes';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
  'access-control-expose-headers': 'etag',
};

const PERFIL = {
  id: '01960000-0000-7000-0000-0000000000a1',
  nome: 'Operador de inscrições',
  descricao: 'Opera as inscrições.',
  ativo: true,
  governanca: null,
  sensibilidade: 'interno',
  temVersaoVigente: true,
  temVersaoPendente: false,
};

const DETALHE_DO_PERFIL = {
  id: PERFIL.id,
  nome: PERFIL.nome,
  descricao: PERFIL.descricao,
  governanca: null,
  sensibilidade: 'interno',
  composicaoEmVigor: {
    versaoId: '01960000-0000-7000-0000-0000000000b1',
    numero: 1,
    permissoes: [],
    protocolo: 'P-1/2026',
    documentoVerificadoEm: '2026-10-20T12:00:00Z',
    desde: '2026-10-21T12:00:00Z',
  },
  versaoPendente: null,
  ultimaVersaoEncerradaSemVigor: null,
  suspensao: null,
};

const URL_DE_ENVIO = 'http://localhost:9000/uniplus-teste/documento-do-perfil.pdf';
const ENVIO_DO_DOCUMENTO = {
  perfilId: '01960000-0000-7000-0000-0000000000a2',
  versaoId: '01960000-0000-7000-0000-0000000000b2',
  documentoId: '01960000-0000-7000-0000-0000000000c2',
  situacao: 'aguardando_envio',
  urlDeEnvio: URL_DE_ENVIO,
  tipoDeMidia: 'application/pdf',
  expiraEm: '2099-01-01T00:00:00Z',
};
const PDF_DO_TESTE = {
  name: 'portaria.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4\n%%EOF\n'),
};

const CATALOGO = [
  {
    modulo: 'selecao',
    resources: [
      {
        resource: 'processos',
        permissoes: [
          {
            codigo: 'selecao:processos:configurar',
            nome: 'Configurar processos',
            descricao: '',
            sensibilidade: 'interno',
          },
        ],
      },
    ],
  },
];

const CONCESSAO = {
  id: '01960000-0000-7000-0000-0000000000c1',
  beneficiario: { emissor: 'unifesspa', sub: 'sub-betina-0002-ficticia' },
  perfil: { id: PERFIL.id, nome: PERFIL.nome },
  versao: 1,
  escopo: { tipo: 'unidade', unidadeId: '01960000-0000-7000-0000-00000000aa01' },
  origem: { tipo: 'pedido', id: '01960000-0000-7000-0000-00000000cc01' },
  concedidaEm: '2026-10-28T12:00:00Z',
  validaAte: null,
  revogadaEm: null,
  revogadaPor: null,
  motivoRevogacao: null,
  ativa: true,
};

/** Atraso da recarga da lista após a escrita: o botão da linha ainda está indisponível quando a sobreposição fecha. */
const ATRASO_DA_RECARGA_EM_MS = 1500;

const problema = (status: number, code: string, title: string, errors?: unknown[]) => ({
  type: 'about:blank',
  title,
  status,
  code,
  ...(errors ? { errors } : {}),
});
const ERRO_INTERNO = problema(500, 'uniplus.internal.unexpected', 'Erro interno');
const RECUSA_DE_NOME = problema(422, 'uniplus.validacao', 'Dados inválidos', [
  {
    field: 'Nome',
    code: 'uniplus.autorizacao.perfil.nome_invalido',
    message: 'Nome fora do padrão.',
  },
]);
const NOME_DUPLICADO = problema(
  409,
  'uniplus.autorizacao.perfil.nome_duplicado',
  'Já existe perfil com este nome',
);
const JA_REVOGADA = problema(
  409,
  'uniplus.autorizacao.concessao.ja_revogada',
  'Concessão já revogada',
);
const EM_PROCESSAMENTO = problema(
  409,
  'uniplus.idempotency.processing_conflict',
  'Escrita em processamento',
);

type Recarga = 'com-o-item' | 'sem-o-item' | 'com-falha';
/** `listaMudou`: a escrita foi recusada porque a lista já estava desatualizada; a recarga traz o estado novo. */
type Resposta = { status: number; corpo?: unknown; listaMudou?: boolean };
type Envio = { metodo: string; chave: string | undefined };

const OK = { status: 204 };

async function responder(route: Route, resposta: Resposta): Promise<void> {
  const { status, corpo } = resposta;
  await route.fulfill({
    status,
    headers: CORS_HEADERS,
    ...(corpo === undefined
      ? {}
      : {
          contentType: status >= 400 ? 'application/problem+json' : 'application/json',
          body: JSON.stringify(corpo),
        }),
  });
}

/**
 * Cada escrita consome a próxima resposta e fica retida até `liberar`. Depois da primeira escrita
 * bem-sucedida, a recarga da lista demora `ATRASO_DA_RECARGA_EM_MS` e responde conforme `recarga`.
 */
async function mockPerfis(
  page: Page,
  respostas: readonly Resposta[],
  recarga: Recarga = 'com-o-item',
  primeiraConsulta: 'ok' | 'falha' = 'ok',
) {
  let liberar: () => void = () => undefined;
  const retida = new Promise<void>((resolve) => (liberar = resolve));
  const envios: Envio[] = [];
  const perfil = { ...PERFIL };
  let gravou = false;
  let consultas = 0;
  await page.route(/\/api\/autorizacao\/permissoes(\?.*)?$/, (route) =>
    route.fulfill({ status: 200, headers: CORS_HEADERS, json: CATALOGO }),
  );
  await page.route(/\/api\/autorizacao\/perfis(\/[^/?]+(\/(desativacao|reativacao|contencao))?)?(\?.*)?$/, async (route) => {
    const requisicao = route.request();
    if (requisicao.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    if (requisicao.method() === 'GET') {
      consultas += 1;
      if (primeiraConsulta === 'falha' && consultas === 1) {
        await responder(route, { status: 500, corpo: ERRO_INTERNO });
        return;
      }
      if (consultas > 1)
        await new Promise((resolve) => setTimeout(resolve, ATRASO_DA_RECARGA_EM_MS));
      if (gravou && recarga === 'com-falha') {
        await responder(route, { status: 500, corpo: ERRO_INTERNO });
        return;
      }
      const caminho = new URL(requisicao.url()).pathname;
      if (caminho.endsWith('/contencao')) {
        await responder(route, { status: 200, corpo: [] });
        return;
      }
      if (caminho.endsWith(`/perfis/${PERFIL.id}`)) {
        await responder(route, {
          status: 200,
          corpo: {
            ...DETALHE_DO_PERFIL,
            ativo: perfil.ativo,
            desativadoDesde: perfil.ativo ? null : '2026-11-10T12:00:00Z',
          },
        });
        return;
      }
      await responder(route, {
        status: 200,
        corpo: gravou && recarga === 'sem-o-item' ? [] : [perfil],
      });
      return;
    }
    const resposta = respostas[envios.length] ?? OK;
    envios.push({
      metodo: requisicao.method(),
      chave: requisicao.headers()['idempotency-key'],
    });
    await retida;
    if (resposta.status < 300) {
      gravou = true;
      if (requisicao.url().endsWith('/desativacao')) perfil.ativo = false;
      if (requisicao.url().endsWith('/reativacao')) perfil.ativo = true;
    }
    await responder(
      route,
      resposta.status === 201 ? { status: 201, corpo: ENVIO_DO_DOCUMENTO } : resposta,
    );
  });
  await page.route(URL_DE_ENVIO, (route) =>
    route.fulfill({ status: 200, headers: { ...CORS_HEADERS, etag: '"etag-do-teste"' } }),
  );
  await page.route(/\/api\/autorizacao\/perfis\/[^/]+\/versoes\/[^/]+\/documento\/confirmacao$/, (route) =>
    route.fulfill({
      status: route.request().method() === 'OPTIONS' ? 204 : 200,
      headers: CORS_HEADERS,
      ...(route.request().method() === 'OPTIONS' ? {} : { json: {} }),
    }),
  );
  return { liberar, envios };
}

async function mockConcessoes(
  page: Page,
  respostas: readonly Resposta[],
  recarga: Recarga = 'sem-o-item',
) {
  let liberar: () => void = () => undefined;
  const retida = new Promise<void>((resolve) => (liberar = resolve));
  const envios: Envio[] = [];
  let gravou = false;
  await page.route(/\/api\/organizacao\/unidades(\?.*)?$/, (route) =>
    route.fulfill({ status: 200, headers: CORS_HEADERS, json: [] }),
  );
  await page.route(
    /\/api\/autorizacao\/concessoes(\/[^/?]+\/revogacao)?(\?.*)?$/,
    async (route) => {
      const requisicao = route.request();
      if (requisicao.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: CORS_HEADERS });
        return;
      }
      if (requisicao.method() === 'GET') {
        if (gravou) await new Promise((resolve) => setTimeout(resolve, ATRASO_DA_RECARGA_EM_MS));
        if (gravou && recarga === 'com-falha') {
          await responder(route, { status: 500, corpo: ERRO_INTERNO });
          return;
        }
        await responder(route, {
          status: 200,
          corpo: gravou && recarga === 'sem-o-item' ? [] : [CONCESSAO],
        });
        return;
      }
      const resposta = respostas[envios.length] ?? OK;
      envios.push({ metodo: requisicao.method(), chave: undefined });
      await retida;
      if (resposta.status < 300 || resposta.listaMudou) gravou = true;
      await responder(route, resposta);
    },
  );
  return { liberar, envios };
}

const tituloDePerfis = (page: Page): Locator =>
  page.getByRole('heading', { name: 'Perfis', level: 2, exact: true });
const linkDoPerfil = (page: Page): Locator => page.getByRole('link', { name: PERFIL.nome });
const acaoDoPerfil = (page: Page, verbo: 'Reativar' | 'Desativar'): Locator =>
  page.getByRole('button', { name: verbo, exact: true });
const tituloDoPerfil = (page: Page): Locator =>
  page.getByRole('heading', { name: PERFIL.nome, level: 1 });
const dialogoDeContencao = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Desativar o perfil' });
const novo = (page: Page): Locator => page.getByRole('button', { name: 'Novo perfil' });
const drawer = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Formulário de perfil de acesso' });

async function abrirCriacao(page: Page, completo = true): Promise<Locator> {
  await page.goto('/acessos/perfis');
  await novo(page).click();
  const formulario = drawer(page);
  await expect(formulario).toBeVisible();
  await formulario.locator('input[formcontrolname="nome"]').fill('Consulta');
  await formulario.locator('textarea[formcontrolname="descricao"]').fill('Só consulta.');
  if (completo) {
    await formulario.locator('input[formcontrolname="protocolo"]').fill('P-1/2026');
    await formulario
      .locator('label.checkbox', { hasText: 'selecao:processos:configurar' })
      .click();
    await formulario.locator('input[type="file"]').setInputFiles(PDF_DO_TESTE);
  }
  return formulario;
}

test.describe('Acessos — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
    await mockPermissoesEfetivas(page, PERMISSOES_DO_DIOGO);
  });

  test.describe('perfis', () => {
    test('criação pendente preserva foco e valores, ignora o clique repetido e a recusa foca o campo', async ({
      page,
    }) => {
      const { liberar, envios } = await mockPerfis(page, [{ status: 422, corpo: RECUSA_DE_NOME }]);
      const formulario = await abrirCriacao(page);
      const nome = formulario.locator('input[formcontrolname="nome"]');
      await nome.fill('Consulta revisada');
      await formulario.getByRole('button', { name: 'Salvar perfil' }).click();
      const salvar = formulario.getByRole('button', { name: 'Salvando…' });

      await expect(nome).toBeDisabled();
      await expect(nome).toHaveValue('Consulta revisada');
      await expect(salvar).toBeFocused();
      await expect(salvar).toHaveAttribute('aria-disabled', 'true');
      await expect(salvar).toHaveAttribute('aria-busy', 'true');
      await expect(salvar).toHaveCSS('cursor', 'not-allowed');
      await expect(formulario.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
      await page.keyboard.press('Escape');
      await expect(formulario).toBeVisible();
      await expect(formulario.getByRole('button', { name: 'Fechar' })).toBeDisabled();
      await salvar.dispatchEvent('click');
      await page.keyboard.press('Enter');
      await page.keyboard.press('Space');
      expect(envios.map((envio) => envio.metodo)).toEqual(['POST']);

      liberar();
      await expect(nome).toBeEnabled();
      await expect(nome).toBeFocused();
      await expect(nome).toHaveAttribute('aria-invalid', 'true');
      await expect(formulario.getByText('Nome fora do padrão.')).toBeVisible();
      expect(envios.map((envio) => envio.metodo)).toEqual(['POST']);
    });

    test('Enter no campo leva o foco ao botão de salvar e, na falha 500, o envio segue disponível', async ({
      page,
    }) => {
      const { liberar, envios } = await mockPerfis(page, [{ status: 500, corpo: ERRO_INTERNO }]);
      const formulario = await abrirCriacao(page);
      const nome = formulario.locator('input[formcontrolname="nome"]');
      await nome.focus();
      await page.keyboard.press('Enter');

      await expect(nome).toBeDisabled();
      await expect(formulario.getByRole('button', { name: 'Salvando…' })).toBeFocused();
      liberar();
      await expect(formulario.getByText('Erro interno')).toBeVisible();
      await expect(nome).toBeEnabled();
      await expect(formulario.getByRole('button', { name: 'Salvar perfil' })).toBeFocused();
      expect(envios).toHaveLength(1);
    });

    test('envio barrado localmente leva o foco ao primeiro campo inválido', async ({ page }) => {
      const { envios } = await mockPerfis(page, []);
      const formulario = await abrirCriacao(page, false);
      const nome = formulario.locator('input[formcontrolname="nome"]');
      await nome.fill('');
      await formulario.getByRole('button', { name: 'Salvar perfil' }).focus();
      await page.keyboard.press('Enter');

      await expect(nome).toBeFocused();
      await expect(nome).toHaveAttribute('aria-invalid', 'true');
      await expect(nome).toHaveAttribute('aria-required', 'true');
      await expect(formulario.getByText('Anexe o PDF do documento instituidor.')).toBeVisible();
      expect(envios).toEqual([]);
    });

    test('nome já existente marca o campo e o reenvio usa chave nova; conflito de processamento mantém a chave', async ({
      page,
    }) => {
      const { liberar, envios } = await mockPerfis(page, [
        { status: 409, corpo: NOME_DUPLICADO },
        { status: 409, corpo: EM_PROCESSAMENTO },
        { status: 409, corpo: EM_PROCESSAMENTO },
      ]);
      liberar();
      const formulario = await abrirCriacao(page);
      const nome = formulario.locator('input[formcontrolname="nome"]');
      await formulario.getByRole('button', { name: 'Salvar perfil' }).click();

      await expect(nome).toHaveAttribute('aria-invalid', 'true');
      await expect(nome).toBeFocused();
      await expect(formulario.getByText('Já existe um perfil com esse nome.')).toBeVisible();
      await expect(formulario.getByText('Não foi possível salvar')).toHaveCount(0);

      await nome.fill('Consulta 2');
      await formulario.getByRole('button', { name: 'Salvar perfil' }).click();
      await expect(
        formulario.getByText('Não foi possível saber se o perfil foi criado'),
      ).toBeVisible();
      await formulario.getByRole('button', { name: 'Salvar perfil' }).click();
      await expect.poll(() => envios.length).toBe(3);

      expect(envios[1]?.chave).not.toBe(envios[0]?.chave);
      expect(envios[2]?.chave).toBe(envios[1]?.chave);
    });

    test('"Tentar novamente" fica focado e indisponível durante a carga e leva o foco ao título', async ({
      page,
    }) => {
      await mockPerfis(page, [], 'com-o-item', 'falha');
      await page.goto('/acessos/perfis');
      const tentar = page.getByRole('button', { name: 'Tentar novamente' });
      await tentar.click();

      await expect(tentar).toBeFocused();
      await expect(tentar).toHaveAttribute('aria-disabled', 'true');
      await expect(linkDoPerfil(page)).toBeVisible();
      await expect(tituloDePerfis(page)).toBeFocused();
    });

    test('criação concluída envia o PDF, confirma o envio e devolve o foco ao botão Novo perfil', async ({
      page,
    }) => {
      const { liberar } = await mockPerfis(page, [{ status: 201 }]);
      const confirmacao = page.waitForRequest(/\/documento\/confirmacao$/);
      const formulario = await abrirCriacao(page);
      await formulario.getByRole('button', { name: 'Salvar perfil' }).click();
      liberar();

      expect((await confirmacao).postDataJSON()).toEqual({ etag: '"etag-do-teste"' });
      await expect(formulario).toBeHidden();
      await expect(novo(page)).toBeFocused();
    });

    test('criação concluída, com falha na recarga, leva o foco ao título da lista', async ({
      page,
    }) => {
      const { liberar } = await mockPerfis(page, [{ status: 201 }], 'com-falha');
      const formulario = await abrirCriacao(page);
      await formulario.getByRole('button', { name: 'Salvar perfil' }).click();
      liberar();

      await expect(formulario).toBeHidden();
      await expect(tituloDePerfis(page)).toBeFocused();
    });

    async function abrirDesativacao(page: Page): Promise<Locator> {
      await page.goto(`/acessos/perfis/${PERFIL.id}`);
      await acaoDoPerfil(page, 'Desativar').click();
      const caixa = dialogoDeContencao(page);
      await expect(caixa).toBeVisible();
      return caixa;
    }

    test('desativação pendente deixa o diálogo somente leitura e envia o comando uma só vez, com chave', async ({
      page,
    }) => {
      const { liberar, envios } = await mockPerfis(page, [OK]);
      const caixa = await abrirDesativacao(page);
      await caixa.getByLabel('Motivo').fill('Perfil sem uso.');
      const confirmar = caixa.getByRole('button', { name: 'Desativar perfil' });
      await confirmar.click();

      await expect(caixa.getByLabel('Motivo')).toBeDisabled();
      await expect(caixa.getByLabel('Motivo')).toHaveValue('Perfil sem uso.');
      await expect(confirmar).toHaveAttribute('aria-busy', 'true');
      await expect(caixa.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
      await expect(acaoDoPerfil(page, 'Desativar')).toBeDisabled();
      await confirmar.dispatchEvent('click');
      expect(envios.map((envio) => envio.metodo)).toEqual(['POST']);
      expect(envios[0]?.chave).toBeTruthy();

      liberar();
      await expect(caixa).toBeHidden();
      expect(envios).toHaveLength(1);
    });

    test('desativação concluída relê o perfil, oferece reativar e leva o foco ao título', async ({
      page,
    }) => {
      const { liberar } = await mockPerfis(page, [OK]);
      const caixa = await abrirDesativacao(page);
      await caixa.getByLabel('Motivo').fill('Perfil sem uso.');
      await caixa.getByRole('button', { name: 'Desativar perfil' }).click();
      liberar();

      await expect(caixa).toBeHidden();
      await expect(acaoDoPerfil(page, 'Reativar')).toBeVisible();
      await expect(acaoDoPerfil(page, 'Desativar')).toHaveCount(0);
      await expect(tituloDoPerfil(page)).toBeFocused();
    });

    test('reativação pede o motivo, envia por POST em reativacao e volta a oferecer desativar', async ({
      page,
    }) => {
      const { liberar, envios } = await mockPerfis(page, [OK, OK]);
      liberar();
      const desativacao = await abrirDesativacao(page);
      await desativacao.getByLabel('Motivo').fill('Perfil sem uso.');
      await desativacao.getByRole('button', { name: 'Desativar perfil' }).click();
      await expect(acaoDoPerfil(page, 'Reativar')).toBeVisible();

      await acaoDoPerfil(page, 'Reativar').click();
      const reativacao = page.getByRole('dialog', { name: 'Reativar o perfil' });
      await reativacao.getByLabel('Motivo').fill('Voltou a ser usado.');
      await reativacao.getByRole('button', { name: 'Reativar perfil' }).click();

      await expect(reativacao).toBeHidden();
      await expect(acaoDoPerfil(page, 'Desativar')).toBeVisible();
      expect(envios).toHaveLength(2);
      expect(envios[1]?.chave).not.toBe(envios[0]?.chave);
    });

    test('desativação sem motivo marca o campo, leva o foco a ele e não chama a API', async ({
      page,
    }) => {
      const { envios } = await mockPerfis(page, []);
      const caixa = await abrirDesativacao(page);
      await caixa.getByRole('button', { name: 'Desativar perfil' }).click();

      const motivo = caixa.getByLabel('Motivo');
      await expect(motivo).toHaveAttribute('aria-invalid', 'true');
      await expect(motivo).toBeFocused();
      await expect(caixa.getByRole('alert')).toContainText('Informe o motivo');
      expect(envios).toEqual([]);
    });
  });

  test.describe('revogação de concessões', () => {
    const revogar = (page: Page): Locator =>
      page.getByRole('button', { name: `Revogar a concessão de ${PERFIL.nome}` });
    const dialogo = (page: Page): Locator =>
      page.getByRole('dialog', { name: 'Revogar a concessão' });
    const tituloDeConcessoes = (page: Page): Locator =>
      page.getByRole('heading', { name: 'Concessões', level: 2, exact: true });

    async function abrirRevogacao(page: Page): Promise<Locator> {
      await page.goto('/acessos/concessoes');
      await revogar(page).click();
      const caixa = dialogo(page);
      await expect(caixa).toBeVisible();
      await caixa.getByLabel('E-mail do beneficiário').fill('betina.teste@unifesspa.edu.br');
      await caixa.getByLabel('Motivo').fill('Deixou a função na unidade.');
      return caixa;
    }

    test('revogação pendente mantém o diálogo somente leitura e não envia de novo', async ({
      page,
    }) => {
      const { liberar, envios } = await mockConcessoes(page, [OK]);
      const caixa = await abrirRevogacao(page);
      const confirmar = caixa.getByRole('button', { name: 'Revogar concessão' });
      await confirmar.click();

      await expect(caixa.getByLabel('Motivo')).toBeDisabled();
      await expect(caixa.getByLabel('Motivo')).toHaveValue('Deixou a função na unidade.');
      await expect(confirmar).toHaveAttribute('aria-disabled', 'true');
      await expect(confirmar).toHaveAttribute('aria-busy', 'true');
      await expect(confirmar).toHaveCSS('cursor', 'not-allowed');
      await expect(
        caixa.getByRole('status').filter({ hasText: 'Revogando concessão' }),
      ).toContainText('Revogando concessão');
      await expect(caixa.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
      await expect(caixa.getByRole('button', { name: 'Fechar' })).toBeDisabled();
      await page.keyboard.press('Escape');
      await expect(caixa).toBeVisible();
      await confirmar.dispatchEvent('click');
      expect(envios).toHaveLength(1);

      liberar();
      await expect(caixa).toBeHidden();
      expect(envios).toHaveLength(1);
    });

    test('e-mail divergente fica no campo, com o foco nele', async ({ page }) => {
      const { liberar } = await mockConcessoes(page, [
        {
          status: 422,
          corpo: problema(422, 'uniplus.validacao', 'Dados inválidos', [
            {
              field: 'confirmacaoEmail',
              code: 'uniplus.autorizacao.concessao.confirmacao_divergente',
              message: 'O e-mail informado não é o do beneficiário da concessão.',
            },
          ]),
        },
      ]);
      const caixa = await abrirRevogacao(page);
      await caixa.getByRole('button', { name: 'Revogar concessão' }).click();
      liberar();

      const email = caixa.getByLabel('E-mail do beneficiário');
      await expect(email).toHaveAttribute('aria-invalid', 'true');
      await expect(email).toBeFocused();
      await expect(email).toHaveAttribute('aria-required', 'true');
      await expect(caixa.getByText('O e-mail informado não é o do beneficiário')).toBeVisible();
    });

    test('revogação concluída, com a linha ausente da recarga atrasada, leva o foco ao título', async ({
      page,
    }) => {
      const { liberar } = await mockConcessoes(page, [OK], 'sem-o-item');
      const caixa = await abrirRevogacao(page);
      await caixa.getByRole('button', { name: 'Revogar concessão' }).click();
      liberar();

      await expect(caixa).toBeHidden();
      await expect(tituloDeConcessoes(page)).toBeFocused();
    });

    test('revogação concluída, com a linha ainda na recarga, devolve o foco ao botão dela', async ({
      page,
    }) => {
      const { liberar } = await mockConcessoes(page, [OK], 'com-o-item');
      const caixa = await abrirRevogacao(page);
      await caixa.getByRole('button', { name: 'Revogar concessão' }).click();
      liberar();

      await expect(caixa).toBeHidden();
      await expect(revogar(page)).toBeFocused();
    });

    test('revogação concluída, com falha na recarga, leva o foco ao título', async ({ page }) => {
      const { liberar } = await mockConcessoes(page, [OK], 'com-falha');
      const caixa = await abrirRevogacao(page);
      await caixa.getByRole('button', { name: 'Revogar concessão' }).click();
      liberar();

      await expect(caixa).toBeHidden();
      await expect(tituloDeConcessoes(page)).toBeFocused();
    });

    test('concessão já revogada: a recarga tira a linha, e o foco só vai ao título quando o diálogo fecha', async ({
      page,
    }) => {
      const { liberar } = await mockConcessoes(
        page,
        [{ status: 409, corpo: JA_REVOGADA, listaMudou: true }],
        'sem-o-item',
      );
      const caixa = await abrirRevogacao(page);
      await caixa.getByRole('button', { name: 'Revogar concessão' }).click();
      liberar();

      await expect(caixa.getByText('A concessão já foi revogada.')).toBeVisible();
      await expect(revogar(page)).toHaveCount(0);
      await expect(caixa).toBeVisible();
      await expect(tituloDeConcessoes(page)).not.toBeFocused();

      await caixa.getByRole('button', { name: 'Cancelar' }).click();

      await expect(caixa).toBeHidden();
      await expect(tituloDeConcessoes(page)).toBeFocused();
    });

    test('revogação recusada mantém o diálogo aberto e o foco dentro dele', async ({ page }) => {
      const { liberar } = await mockConcessoes(page, [{ status: 500, corpo: ERRO_INTERNO }]);
      const caixa = await abrirRevogacao(page);
      await caixa.getByRole('button', { name: 'Revogar concessão' }).click();
      liberar();

      await expect(caixa.getByText('Erro interno')).toBeVisible();
      await expect(caixa.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
      await expect(caixa).toBeVisible();
      await expect(tituloDeConcessoes(page)).not.toBeFocused();
      await expect(caixa.locator(':focus')).toHaveCount(1);
    });
  });

  test.describe('decisão do pedido', () => {
    const PEDIDO_ID = '01960000-0000-7000-0000-00000000cc01';
    const tituloDoPedido = (page: Page): Locator =>
      page.getByRole('heading', { name: 'Pedido de acesso', level: 1 });

    test('aprovar leva o foco ao título quando o botão some com a recarga do pedido', async ({
      page,
    }) => {
      await mockApiDeAcesso(page, [pedidoSeed()]);
      await page.goto(`/acessos/pedidos/${PEDIDO_ID}`);
      await page.getByRole('button', { name: 'Aprovar' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Aprovar' }).click();

      await expect(page.getByText('Aguardando a proteção de dados').first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Aprovar' })).toHaveCount(0);
      await expect(tituloDoPedido(page)).toBeFocused();
    });

    test('recusar leva o foco ao título quando o botão some com a recarga do pedido', async ({
      page,
    }) => {
      await mockApiDeAcesso(page, [pedidoSeed()]);
      await page.goto(`/acessos/pedidos/${PEDIDO_ID}`);
      await page.getByRole('button', { name: 'Recusar', exact: true }).click();
      const caixa = page.getByRole('dialog', { name: 'Recusar o pedido' });
      await caixa.getByLabel('Motivo').fill('Sem necessidade funcional.');
      await caixa.getByRole('button', { name: 'Recusar pedido' }).click();

      await expect(page.getByRole('button', { name: 'Recusar', exact: true })).toHaveCount(0);
      await expect(tituloDoPedido(page)).toBeFocused();
    });
  });
});
