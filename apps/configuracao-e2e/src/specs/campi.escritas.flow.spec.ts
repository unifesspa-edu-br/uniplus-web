import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const CAMPUS = {
  id: '01960000-0000-7000-0000-0000000000b1',
  sigla: 'MARABA',
  nome: 'Campus de Marabá',
  codigoEmec: '12345',
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
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

/** Atraso da recarga da lista após a escrita: os botões da linha ainda estão indisponíveis quando a sobreposição fecha. */
const ATRASO_DA_RECARGA_EM_MS = 1500;

const problema = (status: number, code: string, title: string, errors?: unknown[]) => ({
  type: 'about:blank',
  title,
  status,
  code,
  ...(errors === undefined ? {} : { errors }),
});

const RECUSA_DA_SIGLA = problema(422, 'uniplus.validacao', 'Dados inválidos', [
  {
    field: 'Sigla',
    code: 'uniplus.configuracao.campus.sigla_tamanho',
    message: 'Sigla fora do padrão.',
  },
]);
const RECUSA_DO_ENDERECO = problema(422, 'uniplus.validacao', 'Dados inválidos', [
  {
    field: 'CidadeCodigoIbge',
    code: 'uniplus.configuracao.campus.cidade_divergente',
    message: 'A cidade não corresponde ao CEP informado.',
  },
]);
const SIGLA_JA_EXISTE = problema(
  409,
  'uniplus.configuracao.campus.sigla_ja_existe',
  'Já existe um campus ativo com esta sigla',
);
const PROCESSAMENTO_EM_CURSO = problema(
  409,
  'uniplus.idempotency.processing_conflict',
  'A requisição anterior ainda está em processamento',
);
const REMOCAO_BLOQUEADA = problema(
  409,
  'uniplus.configuracao.campus.remocao_bloqueada_por_local_oferta',
  'Não é possível remover um campus responsável por locais de oferta ativos',
);
const ERRO_INTERNO = problema(500, 'uniplus.erro_interno', 'Falha ao gravar o campus');

type Recarga = 'com-o-campus' | 'sem-o-campus' | 'com-falha';
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

/**
 * Cada escrita consome a próxima resposta (a última se repete) e fica retida até `liberar`. A
 * recarga que segue uma escrita aceita demora `ATRASO_DA_RECARGA_EM_MS` e responde conforme
 * `recarga`; sem escrita aceita, a lista responde com o campus.
 */
async function mockApi(
  page: Page,
  respostas: readonly Resposta[],
  recarga: Recarga = 'com-o-campus',
  primeiraConsulta: 'ok' | 'falha' = 'ok',
) {
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
  await page.route(/\/api\/configuracao\/campi(\?.*)?$/, async (route) => {
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
    const semCampus = aceita && recarga === 'sem-o-campus';
    await responder(route, { status: 200, corpo: semCampus ? [] : [CAMPUS] });
  });
  await page.route(/\/api\/configuracao\/admin\/campi(\/[^/?]+)?$/, async (route) => {
    const requisicao = route.request();
    if (requisicao.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    const resposta = respostas[Math.min(envios.length, respostas.length - 1)];
    envios.push(requisicao.method());
    chaves.push(requisicao.headers()['idempotency-key'] ?? '');
    await retida;
    aceita = resposta.status < 400;
    await responder(route, resposta);
  });
  return { liberar, envios, chaves };
}

const titulo = (page: Page) => page.getByRole('heading', { name: 'Campi', level: 2 });
const drawer = (page: Page) => page.getByRole('dialog', { name: 'Formulário de campus' });
const confirmacao = (page: Page) => page.getByRole('dialog', { name: 'Remover campus' });

async function abrirEdicao(page: Page): Promise<{ acionador: Locator; formulario: Locator }> {
  await page.goto('/campi');
  const acionador = page.getByRole('button', { name: 'Editar campus MARABA' });
  await acionador.click();
  return { acionador, formulario: drawer(page) };
}

async function abrirConfirmacao(page: Page): Promise<{ acionador: Locator; dialogo: Locator }> {
  await page.goto('/campi');
  const acionador = page.getByRole('button', { name: 'Remover campus MARABA' });
  await acionador.click();
  return { acionador, dialogo: confirmacao(page) };
}

async function preencherCadastroComCep(page: Page): Promise<Locator> {
  await page.goto('/campi');
  await page.getByRole('button', { name: 'Novo campus' }).first().click();
  const formulario = drawer(page);
  await formulario.locator('[formControlName="sigla"]').fill('PARAUAPEBAS');
  await formulario.locator('[formControlName="nome"]').fill('Campus de Parauapebas');
  await page.locator('#campus-endereco-cep').fill('68507590');
  await page.getByRole('button', { name: 'Buscar CEP' }).click();
  await expect(page.locator('#campus-endereco-logradouro')).toHaveValue('Rua Folha 31, Quadra 7');
  return formulario;
}

test.describe('Campus — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('edição pendente preserva foco e valores, recusa reenvio e a recusa foca o campo', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [{ status: 422, corpo: RECUSA_DA_SIGLA }]);
    const { formulario } = await abrirEdicao(page);
    const nome = formulario.locator('input[formcontrolname="nome"]');
    const sigla = formulario.locator('input[formcontrolname="sigla"]');
    await nome.fill('Campus de Marabá revisado');
    await formulario.getByRole('button', { name: 'Salvar campus' }).click();
    const salvar = formulario.getByRole('button', { name: 'Salvando...' });
    await expect(nome).toBeDisabled();
    await expect(nome).toHaveValue('Campus de Marabá revisado');
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
    await expect(sigla).toBeFocused();
    await expect(sigla).toHaveAttribute('aria-invalid', 'true');
    await expect(formulario.getByText('Sigla fora do padrão.')).toBeVisible();
  });

  test('falha geral no salvamento mantém o foco no botão de salvar', async ({ page }) => {
    const { liberar } = await mockApi(page, [{ status: 500, corpo: ERRO_INTERNO }]);
    const { formulario } = await abrirEdicao(page);
    await formulario.getByRole('button', { name: 'Salvar campus' }).click();
    liberar();
    await expect(formulario.getByText('Falha ao gravar o campus')).toBeVisible();
    await expect(formulario.getByRole('button', { name: 'Salvar campus' })).toBeFocused();
  });

  test('sigla já cadastrada marca o campo e renova a chave; processamento em curso a mantém', async ({
    page,
  }) => {
    const { liberar, chaves } = await mockApi(page, [
      { status: 409, corpo: PROCESSAMENTO_EM_CURSO },
      { status: 409, corpo: SIGLA_JA_EXISTE },
    ]);
    const { formulario } = await abrirEdicao(page);
    const salvar = formulario.getByRole('button', { name: 'Salvar campus' });
    await salvar.click();
    liberar();
    await expect(
      formulario.getByText('A requisição anterior ainda está em processamento'),
    ).toBeVisible();
    await expect(salvar).toBeFocused();
    await salvar.click();
    const sigla = formulario.locator('input[formcontrolname="sigla"]');
    await expect(sigla).toBeFocused();
    await expect(sigla).toHaveAttribute('aria-invalid', 'true');
    expect(chaves).toHaveLength(2);
    expect(chaves[1]).toBe(chaves[0]);
    await sigla.fill('MARABA2');
    await salvar.click();
    await expect.poll(() => chaves.length).toBe(3);
    expect(chaves[2]).not.toBe(chaves[1]);
  });

  test('Enter no campo leva o foco ao botão de salvar e, na falha 500, o envio segue disponível', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [{ status: 500, corpo: ERRO_INTERNO }]);
    const { formulario } = await abrirEdicao(page);
    const nome = formulario.locator('input[formcontrolname="nome"]');
    await nome.focus();
    await page.keyboard.press('Enter');
    await expect(nome).toBeDisabled();
    await expect(formulario.getByRole('button', { name: 'Salvando...' })).toBeFocused();
    liberar();
    await expect(formulario.getByText('Falha ao gravar o campus')).toBeVisible();
    await expect(nome).toBeEnabled();
    await expect(formulario.getByRole('button', { name: 'Salvar campus' })).toBeFocused();
    expect(envios).toEqual(['PUT']);
  });

  test('cancelar o formulário devolve o foco ao acionador sem enviar', async ({ page }) => {
    const { envios } = await mockApi(page, [{ status: 204 }]);
    const { acionador, formulario } = await abrirEdicao(page);
    await formulario.getByRole('button', { name: 'Cancelar' }).click();
    await expect(formulario).toBeHidden();
    await expect(acionador).toBeFocused();
    expect(envios).toEqual([]);
  });

  test('edição concluída devolve o foco ao acionador depois da recarga', async ({ page }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }]);
    const { acionador, formulario } = await abrirEdicao(page);
    await formulario.getByRole('button', { name: 'Salvar campus' }).click();
    liberar();
    await expect(formulario).toBeHidden();
    await expect(acionador).toBeDisabled();
    await expect(acionador).toBeEnabled();
    await expect(acionador).toBeFocused();
  });

  test('edição concluída, com falha na recarga, leva o foco ao título da lista', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], 'com-falha');
    const { formulario } = await abrirEdicao(page);
    await formulario.getByRole('button', { name: 'Salvar campus' }).click();
    liberar();
    await expect(formulario).toBeHidden();
    await expect(titulo(page)).toBeFocused();
  });

  test('cadastro concluído devolve o foco ao botão que abriu o formulário', async ({ page }) => {
    const { liberar } = await mockApi(page, [{ status: 201, corpo: 'novo-id' }]);
    const formulario = await preencherCadastroComCep(page);
    await formulario.getByRole('button', { name: 'Criar campus' }).click();
    liberar();
    await expect(formulario).toBeHidden();
    await expect(page.getByRole('button', { name: 'Novo campus' })).toBeFocused();
  });

  test('recusa só do endereço leva o foco à mensagem no bloco do endereço', async ({ page }) => {
    const { liberar } = await mockApi(page, [{ status: 422, corpo: RECUSA_DO_ENDERECO }]);
    const formulario = await preencherCadastroComCep(page);
    await formulario.getByRole('button', { name: 'Criar campus' }).click();
    liberar();
    const mensagem = formulario.locator('ui-endereco-geo .field__error');
    await expect(mensagem).toHaveText('A cidade não corresponde ao CEP informado.');
    await expect(mensagem).toBeFocused();
    await expect(formulario.locator('ui-endereco-geo fieldset')).toHaveAttribute(
      'aria-describedby',
      (await mensagem.getAttribute('id')) ?? '',
    );
  });

  test('"Tentar novamente" fica focado e indisponível durante a carga e leva o foco ao título', async ({
    page,
  }) => {
    await mockApi(page, [{ status: 204 }], 'com-o-campus', 'falha');
    await page.goto('/campi');
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('button', { name: 'Editar campus MARABA' })).toBeVisible();
    await expect(titulo(page)).toBeFocused();
  });

  test('remoção pendente mantém o botão focado e indisponível; o segundo clique não envia', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [{ status: 204 }], 'sem-o-campus');
    const { dialogo } = await abrirConfirmacao(page);
    const remover = dialogo.getByRole('button', { name: 'Remover', exact: true });
    await remover.click();
    await expect(remover).toBeFocused();
    await expect(remover).toHaveAttribute('aria-disabled', 'true');
    await expect(remover).toHaveAttribute('aria-busy', 'true');
    await expect(remover).toHaveCSS('cursor', 'not-allowed');
    await expect(dialogo.getByRole('status')).toContainText('Removendo o campus MARABA.');
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

  test('remoção concluída, com o campus ausente da recarga, anuncia e leva o foco ao título', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], 'sem-o-campus');
    const { dialogo } = await abrirConfirmacao(page);
    await dialogo.getByRole('button', { name: 'Remover', exact: true }).click();
    liberar();
    await expect(dialogo).toBeHidden();
    await expect(page.locator('.panel-head .sr-only[role="status"]')).toHaveText(
      'Campus MARABA removido.',
    );
    await expect(titulo(page)).toBeFocused();
  });

  test('remoção concluída, com o campus ainda na recarga, devolve o foco à lixeira da linha', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], 'com-o-campus');
    const { acionador, dialogo } = await abrirConfirmacao(page);
    await dialogo.getByRole('button', { name: 'Remover', exact: true }).click();
    liberar();
    await expect(dialogo).toBeHidden();
    await expect(acionador).toBeDisabled();
    await expect(acionador).toBeEnabled();
    await expect(acionador).toBeFocused();
  });

  test('remoção concluída, com falha na recarga, leva o foco ao título da lista', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], 'com-falha');
    const { dialogo } = await abrirConfirmacao(page);
    await dialogo.getByRole('button', { name: 'Remover', exact: true }).click();
    liberar();
    await expect(dialogo).toBeHidden();
    await expect(titulo(page)).toBeFocused();
  });

  for (const [rotulo, recusa] of [
    ['conflito (409)', { status: 409, corpo: REMOCAO_BLOQUEADA }],
    ['falha (500)', { status: 500, corpo: ERRO_INTERNO }],
  ] as const) {
    test(`remoção recusada por ${rotulo} mantém o diálogo, o foco no botão e aceita nova tentativa`, async ({
      page,
    }) => {
      const { liberar, envios } = await mockApi(page, [recusa, { status: 204 }], 'sem-o-campus');
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

  test('cancelar a confirmação devolve o foco à lixeira da linha', async ({ page }) => {
    const { envios } = await mockApi(page, [{ status: 204 }]);
    const { acionador, dialogo } = await abrirConfirmacao(page);
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();
    await expect(acionador).toBeFocused();
    expect(envios).toEqual([]);
  });
});
