import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const REITORIA_ID = '01960000-0000-7000-0000-000000000001';
const INSTITUICAO = {
  id: '01960000-0000-7000-0000-0000000000a1',
  codigoEmec: '3990',
  nome: 'Universidade Federal do Sul e Sudeste do Pará',
  sigla: 'Unifesspa',
  organizacaoAcademica: 'Universidade',
  categoriaAdministrativa: 'Pública Federal',
  cnpj: null,
  mantenedora: null,
  codigoMantenedoraEmec: null,
  situacao: null,
  atoCredenciamento: null,
  atoRecredenciamento: null,
  conceitoInstitucional: null,
  igc: null,
  website: null,
  cidade: null,
  endereco: null,
  unidadeRaizId: REITORIA_ID,
  criadoEm: '2026-06-10T12:00:00Z',
};
const REITORIA = {
  id: REITORIA_ID,
  nome: 'Reitoria',
  alias: null,
  slug: 'reitoria',
  sigla: 'REITORIA',
  codigo: 'REITORIA',
  unidadeSuperiorId: null,
  tipo: 'Reitoria',
  unidadeAcademica: false,
  vigenciaInicio: '2026-01-01',
  vigenciaFim: null,
  criadoEm: '2026-06-10T12:00:00Z',
};
const CEP_LOGRADOURO = {
  cep: '68507590',
  tipo: 'Rua',
  logradouro: 'Folha 31, Quadra 7',
  complemento: null,
  bairro: 'Nova Marabá',
  distrito: null,
  cidade: 'Marabá',
  codigoIbge: '1504208',
  uf: 'PA',
  latitude: '-5.368',
  longitude: '-49.118',
  nivelResolucao: 'logradouro',
  origem: 'geo-api',
};

/** Atraso da recarga após a escrita: os botões da página ainda estão indisponíveis quando a sobreposição fecha. */
const ATRASO_DA_RECARGA_EM_MS = 1500;

const problema = (status: number, code: string, title: string, errors?: unknown[]) => ({
  type: 'about:blank',
  title,
  status,
  code,
  ...(errors === undefined ? {} : { errors }),
});

const RECUSA_DO_CNPJ = problema(422, 'uniplus.validacao', 'Dados inválidos', [
  {
    field: 'Cnpj',
    code: 'uniplus.organizacao.instituicao.campo_opcional_tamanho',
    message: 'CNPJ fora do padrão.',
  },
]);
const RECUSA_DO_ENDERECO = problema(422, 'uniplus.validacao', 'Dados inválidos', [
  {
    field: 'CidadeCodigoIbge',
    code: 'uniplus.endereco_referencia.cidade_incoerente',
    message: 'A cidade não corresponde ao CEP informado.',
  },
]);
const JA_EXISTE = problema(
  409,
  'uniplus.organizacao.instituicao.ja_existe',
  'Já existe uma instituição cadastrada — a plataforma atende uma única instituição',
);
const PROCESSAMENTO_EM_CURSO = problema(
  409,
  'uniplus.idempotency.processing_conflict',
  'A requisição anterior ainda está em processamento',
);
const NAO_ENCONTRADA = problema(
  404,
  'uniplus.organizacao.instituicao.nao_encontrada',
  'Instituição não encontrada',
);
const ERRO_INTERNO = problema(500, 'uniplus.internal.unexpected', 'Falha ao gravar a instituição');

type Recarga = 'com-a-instituicao' | 'sem-a-instituicao' | 'com-falha';
type Resposta = { status: number; corpo?: unknown };

async function responder(route: Route, { status, corpo }: Resposta): Promise<void> {
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

interface OpcoesDoMock {
  readonly recarga?: Recarga;
  readonly primeiraConsulta?: 'ok' | 'falha';
  readonly cadastrada?: boolean;
}

/**
 * Cada escrita consome a próxima resposta (a última se repete) e fica retida até `liberar`. A
 * recarga que segue uma escrita aceita demora `ATRASO_DA_RECARGA_EM_MS` e responde conforme
 * `recarga`; sem escrita aceita, a leitura responde com a instituição (ou 404, se `cadastrada` é
 * falso).
 */
async function mockApi(page: Page, respostas: readonly Resposta[], opcoes: OpcoesDoMock = {}) {
  const { recarga = 'com-a-instituicao', primeiraConsulta = 'ok', cadastrada = true } = opcoes;
  let liberar: () => void = () => undefined;
  const retida = new Promise<void>((resolve) => (liberar = resolve));
  const envios: string[] = [];
  const chaves: string[] = [];
  let aceita = false;
  let consultas = 0;
  await page.route(/\/api\/cep\/68507590$/, (r) =>
    responder(r, { status: 200, corpo: CEP_LOGRADOURO }),
  );
  await page.route(/\/api\/cidades(\?.*)?$/, (r) => responder(r, { status: 200, corpo: [] }));
  await page.route(/\/api\/organizacao\/unidades(\?.*)?$/, (r) =>
    responder(r, { status: 200, corpo: [REITORIA] }),
  );
  await page.route(/\/api\/organizacao\/instituicao$/, async (route) => {
    consultas += 1;
    if (primeiraConsulta === 'falha' && consultas === 1) {
      await responder(route, { status: 500, corpo: ERRO_INTERNO });
      return;
    }
    if (aceita || consultas > 1) {
      await new Promise((resolve) => setTimeout(resolve, ATRASO_DA_RECARGA_EM_MS));
    }
    if (aceita && recarga === 'com-falha') {
      await responder(route, { status: 500, corpo: ERRO_INTERNO });
      return;
    }
    const ausente = aceita ? recarga === 'sem-a-instituicao' : !cadastrada;
    await responder(route, ausente ? { status: 404 } : { status: 200, corpo: INSTITUICAO });
  });
  await page.route(/\/api\/organizacao\/admin\/instituicao(\/[^/?]+)?$/, async (route) => {
    const requisicao = route.request();
    if (requisicao.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    const resposta = respostas[Math.min(envios.length, respostas.length - 1)];
    envios.push(requisicao.method());
    chaves.push(requisicao.headers()['idempotency-key'] ?? '');
    await retida;
    aceita = resposta.status < 400 || (resposta.status === 404 && requisicao.method() === 'DELETE');
    await responder(route, resposta);
  });
  return { liberar, envios, chaves };
}

const titulo = (page: Page) => page.getByRole('heading', { name: 'Instituição', level: 1 });
const principal = (page: Page) => page.locator('#cfg-instituicao-acao');
const drawer = (page: Page) => page.getByRole('dialog', { name: 'Formulário da instituição' });
const confirmacao = (page: Page) => page.getByRole('dialog', { name: 'Remover instituição' });

/** Abre o formulário pelo botão principal: edita a instituição cadastrada ou, sem ela, cadastra. */
async function abrirFormulario(page: Page): Promise<{ acionador: Locator; formulario: Locator }> {
  await page.goto('/instituicao');
  const acionador = principal(page);
  await acionador.click();
  return { acionador, formulario: drawer(page) };
}

async function preencherObrigatorios(formulario: Locator): Promise<void> {
  await formulario.locator('[formControlName="nome"]').fill(INSTITUICAO.nome);
  await formulario.locator('[formControlName="sigla"]').fill(INSTITUICAO.sigla);
  await formulario.locator('[formControlName="codigoEmec"]').fill(INSTITUICAO.codigoEmec);
  await formulario
    .locator('[formControlName="organizacaoAcademica"]')
    .fill(INSTITUICAO.organizacaoAcademica);
  await formulario
    .locator('[formControlName="categoriaAdministrativa"]')
    .fill(INSTITUICAO.categoriaAdministrativa);
}

async function abrirConfirmacao(page: Page): Promise<{ dialogo: Locator; remover: Locator }> {
  const { formulario } = await abrirFormulario(page);
  const remover = formulario.getByRole('button', { name: 'Remover' });
  await remover.click();
  return { dialogo: confirmacao(page), remover };
}

test.describe('Instituição — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('edição pendente preserva foco e valores, recusa reenvio e a recusa foca o campo', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [{ status: 422, corpo: RECUSA_DO_CNPJ }]);
    const { formulario } = await abrirFormulario(page);
    const nome = formulario.locator('input[formcontrolname="nome"]');
    const cnpj = formulario.locator('input[formcontrolname="cnpj"]');
    await nome.fill('Universidade revisada');
    await formulario.getByRole('button', { name: 'Salvar instituição' }).click();
    const salvar = formulario.getByRole('button', { name: 'Salvando...' });
    await expect(nome).toBeDisabled();
    await expect(nome).toHaveValue('Universidade revisada');
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
    expect(envios).toEqual(['PUT']);
    liberar();
    await expect(nome).toBeEnabled();
    await expect(cnpj).toBeFocused();
    await expect(cnpj).toHaveAttribute('aria-invalid', 'true');
    await expect(formulario.getByText('CNPJ fora do padrão.')).toBeVisible();
  });

  test('falha geral no salvamento mantém o foco no botão de salvar', async ({ page }) => {
    const { liberar } = await mockApi(page, [{ status: 500, corpo: ERRO_INTERNO }]);
    const { formulario } = await abrirFormulario(page);
    await formulario.getByRole('button', { name: 'Salvar instituição' }).click();
    liberar();
    await expect(formulario.getByText('Falha ao gravar a instituição')).toBeVisible();
    await expect(formulario.getByRole('button', { name: 'Salvar instituição' })).toBeFocused();
  });

  test('segunda criação mostra o aviso e renova a chave; processamento em curso a mantém', async ({
    page,
  }) => {
    const { liberar, chaves } = await mockApi(
      page,
      [
        { status: 409, corpo: PROCESSAMENTO_EM_CURSO },
        { status: 409, corpo: JA_EXISTE },
        { status: 409, corpo: JA_EXISTE },
      ],
      { cadastrada: false },
    );
    const { formulario } = await abrirFormulario(page);
    await preencherObrigatorios(formulario);
    const salvar = formulario.getByRole('button', { name: 'Salvar instituição' });
    await salvar.click();
    liberar();
    await expect(
      formulario.getByText('A requisição anterior ainda está em processamento'),
    ).toBeVisible();
    await expect(salvar).toBeFocused();
    await salvar.click();
    await expect(
      formulario.getByText('Já existe uma instituição cadastrada nesta instância'),
    ).toBeVisible();
    await expect(salvar).toBeFocused();
    expect(chaves).toHaveLength(2);
    expect(chaves[1]).toBe(chaves[0]);
    await expect(salvar).not.toHaveAttribute('aria-disabled', 'true');
    await salvar.click();
    await expect.poll(() => chaves.length).toBe(3);
    expect(chaves[2]).not.toBe(chaves[1]);
  });

  test('Enter no campo leva o foco ao botão de salvar e, na falha 500, o envio segue disponível', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [{ status: 500, corpo: ERRO_INTERNO }]);
    const { formulario } = await abrirFormulario(page);
    const nome = formulario.locator('input[formcontrolname="nome"]');
    await nome.focus();
    await page.keyboard.press('Enter');
    await expect(nome).toBeDisabled();
    await expect(formulario.getByRole('button', { name: 'Salvando...' })).toBeFocused();
    liberar();
    await expect(formulario.getByText('Falha ao gravar a instituição')).toBeVisible();
    await expect(nome).toBeEnabled();
    await expect(formulario.getByRole('button', { name: 'Salvar instituição' })).toBeFocused();
    expect(envios).toEqual(['PUT']);
  });

  test('envio barrado localmente leva o foco ao primeiro campo inválido', async ({ page }) => {
    const { envios } = await mockApi(page, [{ status: 201, corpo: 'novo-id' }], {
      cadastrada: false,
    });
    const { formulario } = await abrirFormulario(page);
    await formulario.locator('[formControlName="sigla"]').fill(INSTITUICAO.sigla);
    await formulario.getByRole('button', { name: 'Salvar instituição' }).focus();
    await page.keyboard.press('Enter');
    await expect(formulario.locator('[formControlName="nome"]')).toBeFocused();
    expect(envios).toEqual([]);
  });

  test('recusa só do endereço leva o foco à mensagem no bloco do endereço', async ({ page }) => {
    const { liberar } = await mockApi(page, [{ status: 422, corpo: RECUSA_DO_ENDERECO }]);
    const { formulario } = await abrirFormulario(page);
    await page.locator('#inst-endereco-cep').fill('68507590');
    await page.getByRole('button', { name: 'Buscar CEP' }).click();
    await expect(page.locator('#inst-endereco-logradouro')).toHaveValue('Rua Folha 31, Quadra 7');
    await formulario.getByRole('button', { name: 'Salvar instituição' }).click();
    liberar();
    const mensagem = formulario.locator('ui-endereco-geo .field__error');
    await expect(mensagem).toHaveText('A cidade não corresponde ao CEP informado.');
    await expect(mensagem).toBeFocused();
    await expect(formulario.locator('ui-endereco-geo fieldset')).toHaveAttribute(
      'aria-describedby',
      (await mensagem.getAttribute('id')) ?? '',
    );
  });

  test('cancelar o formulário devolve o foco ao acionador sem enviar', async ({ page }) => {
    const { envios } = await mockApi(page, [{ status: 204 }]);
    const { acionador, formulario } = await abrirFormulario(page);
    await formulario.getByRole('button', { name: 'Cancelar' }).click();
    await expect(formulario).toBeHidden();
    await expect(acionador).toBeFocused();
    expect(envios).toEqual([]);
  });

  test('edição concluída devolve o foco ao acionador depois da recarga', async ({ page }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }]);
    const { acionador, formulario } = await abrirFormulario(page);
    await formulario.getByRole('button', { name: 'Salvar instituição' }).click();
    liberar();
    await expect(formulario).toBeHidden();
    await expect(acionador).toHaveAttribute('aria-disabled', 'true');
    await expect(acionador).not.toHaveAttribute('aria-disabled', 'true');
    await expect(acionador).toBeFocused();
  });

  test('edição concluída, com falha na recarga, leva o foco ao título da página', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], { recarga: 'com-falha' });
    const { formulario } = await abrirFormulario(page);
    await formulario.getByRole('button', { name: 'Salvar instituição' }).click();
    liberar();
    await expect(formulario).toBeHidden();
    await expect(titulo(page)).toBeFocused();
  });

  test('cadastro concluído devolve o foco ao botão que passou a editar', async ({ page }) => {
    const { liberar } = await mockApi(page, [{ status: 201, corpo: 'novo-id' }], {
      cadastrada: false,
    });
    const { formulario } = await abrirFormulario(page);
    await preencherObrigatorios(formulario);
    await formulario.getByRole('button', { name: 'Salvar instituição' }).click();
    liberar();
    await expect(formulario).toBeHidden();
    await expect(principal(page)).toContainText('Editar');
    await expect(principal(page)).toBeFocused();
  });

  test('"Tentar novamente" fica focado e indisponível durante a carga e leva o foco ao título', async ({
    page,
  }) => {
    await mockApi(page, [{ status: 204 }], { primeiraConsulta: 'falha' });
    await page.goto('/instituicao');
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(principal(page)).toContainText('Editar');
    await expect(titulo(page)).toBeFocused();
  });

  test('remoção pendente mantém o botão focado e indisponível; o segundo clique não envia', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [{ status: 204 }], {
      recarga: 'sem-a-instituicao',
    });
    const { dialogo } = await abrirConfirmacao(page);
    const remover = dialogo.getByRole('button', { name: 'Remover', exact: true });
    await remover.click();
    await expect(remover).toBeFocused();
    await expect(remover).toHaveAttribute('aria-disabled', 'true');
    await expect(remover).toHaveAttribute('aria-busy', 'true');
    await expect(remover).toHaveCSS('cursor', 'not-allowed');
    await expect(dialogo.getByRole('status')).toContainText('Removendo a instituição Unifesspa.');
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await expect(dialogo.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeVisible();
    await remover.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(envios).toEqual(['DELETE']);
    liberar();
    await expect(dialogo).toBeHidden();
  });

  test('remoção concluída, com a instituição ausente da recarga, anuncia e leva o foco ao cadastro', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], { recarga: 'sem-a-instituicao' });
    const { dialogo } = await abrirConfirmacao(page);
    await dialogo.getByRole('button', { name: 'Remover', exact: true }).click();
    liberar();
    await expect(dialogo).toBeHidden();
    await expect(page.locator('.cfg-page > .sr-only[role="status"]')).toHaveText(
      'Instituição Unifesspa removida.',
    );
    await expect(principal(page)).toContainText('Cadastrar instituição');
    await expect(principal(page)).toBeFocused();
  });

  test('remoção concluída, com a instituição ainda na recarga, devolve o foco ao botão Editar', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], { recarga: 'com-a-instituicao' });
    const { dialogo } = await abrirConfirmacao(page);
    await dialogo.getByRole('button', { name: 'Remover', exact: true }).click();
    liberar();
    await expect(dialogo).toBeHidden();
    await expect(principal(page)).toContainText('Editar');
    await expect(principal(page)).not.toHaveAttribute('aria-disabled', 'true');
    await expect(principal(page)).toBeFocused();
  });

  test('remoção concluída, com falha na recarga, leva o foco ao título da página', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], { recarga: 'com-falha' });
    const { dialogo } = await abrirConfirmacao(page);
    await dialogo.getByRole('button', { name: 'Remover', exact: true }).click();
    liberar();
    await expect(dialogo).toBeHidden();
    await expect(titulo(page)).toBeFocused();
  });

  for (const [rotulo, recusa] of [['falha (500)', { status: 500, corpo: ERRO_INTERNO }]] as const) {
    test(`remoção recusada por ${rotulo} mantém o diálogo, o foco no botão e aceita nova tentativa`, async ({
      page,
    }) => {
      const { liberar, envios } = await mockApi(page, [recusa, { status: 204 }], {
        recarga: 'sem-a-instituicao',
      });
      const { dialogo } = await abrirConfirmacao(page);
      const remover = dialogo.getByRole('button', { name: 'Remover', exact: true });
      await remover.click();
      liberar();
      await expect(dialogo.locator('.field__error')).toHaveText(recusa.corpo.title);
      await expect(dialogo.getByRole('status')).toContainText('Não foi possível remover');
      await expect(remover).not.toHaveAttribute('aria-disabled', 'true');
      await expect(remover).toBeFocused();
      await remover.click();
      await expect(dialogo).toBeHidden();
      expect(envios).toEqual(['DELETE', 'DELETE']);
    });
  }

  test('remoção de instituição já removida (404) fecha o diálogo e o formulário, anuncia e leva o foco ao cadastro', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [{ status: 404, corpo: NAO_ENCONTRADA }], {
      recarga: 'sem-a-instituicao',
    });
    const { dialogo } = await abrirConfirmacao(page);
    await dialogo.getByRole('button', { name: 'Remover', exact: true }).click();
    liberar();
    await expect(dialogo).toBeHidden();
    await expect(drawer(page)).toBeHidden();
    await expect(page.locator('.cfg-page > .sr-only[role="status"]')).toHaveText(
      'Instituição Unifesspa já havia sido removida.',
    );
    await expect(principal(page)).toContainText('Cadastrar instituição');
    await expect(principal(page)).toBeFocused();
    expect(envios).toEqual(['DELETE']);
  });

  test('cancelar a confirmação devolve o foco ao botão Remover do formulário', async ({ page }) => {
    const { envios } = await mockApi(page, [{ status: 204 }]);
    const { dialogo, remover } = await abrirConfirmacao(page);
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();
    await expect(remover).toBeFocused();
    expect(envios).toEqual([]);
  });
});
