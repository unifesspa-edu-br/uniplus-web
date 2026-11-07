import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

interface Item {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  criadoEm: string;
}

const ATIVO: Item = {
  id: '01960000-0000-7000-0000-000000000051',
  codigo: 'SISU',
  nome: 'SiSU',
  descricao: 'Sistema de Seleção Unificada.',
  ativo: true,
  criadoEm: '2026-08-11T12:00:00Z',
};
const DESATIVADO: Item = {
  id: '01960000-0000-7000-0000-0000000000f0',
  codigo: 'VESTIBULAR_TRAD',
  nome: 'Vestibular tradicional',
  descricao: null,
  ativo: false,
  criadoEm: '2026-05-01T12:00:00Z',
};

/** Atraso da recarga da lista após a escrita: o botão da linha ainda está indisponível quando o diálogo fecha. */
const ATRASO_DA_RECARGA_EM_MS = 1500;

const problema = (status: number, code: string, title: string) => ({
  type: 'about:blank',
  title,
  status,
  code,
});
const PROBLEMA_409_PROCESSANDO = problema(
  409,
  'uniplus.idempotency.processing_conflict',
  'Escrita em processamento',
);
const PROBLEMA_409_CODIGO = problema(
  409,
  'uniplus.configuracao.tipo_processo.codigo_ja_existe',
  'Código do tipo de processo seletivo já está reservado',
);
const PROBLEMA_409_CONCORRENCIA = problema(
  409,
  'uniplus.configuracao.tipo_processo.conflito_de_concorrencia',
  'Tipo de processo seletivo alterado concorrentemente',
);
const PROBLEMA_409_CONCORRENCIA_NA_REMOCAO = problema(
  409,
  'uniplus.concorrencia.conflito',
  'Conflito de concorrência',
);
const PROBLEMA_422_JA_DESATIVADO = problema(
  422,
  'uniplus.configuracao.tipo_processo.ja_desativado',
  'Tipo de processo seletivo já está desativado',
);
const PROBLEMA_422_JA_ATIVO = problema(
  422,
  'uniplus.configuracao.tipo_processo.ja_ativo',
  'Tipo de processo seletivo já está ativo',
);
const PROBLEMA_500 = problema(500, 'uniplus.internal.unexpected', 'Erro interno');
const RECUSA_DE_NOME = {
  type: 'about:blank',
  title: 'Dados inválidos',
  status: 422,
  code: 'uniplus.validacao',
  errors: [
    {
      field: 'Nome',
      code: 'uniplus.configuracao.tipo_processo.nome_tamanho',
      message: 'Nome fora do padrão.',
    },
  ],
};

/** O que a lista devolve depois da escrita bem-sucedida: os itens, ou a falha da recarga. */
type Recarga = readonly Item[] | 'falha';
type Resposta = { status: number; corpo?: unknown };
const CRIADO: Resposta = { status: 201 };
const SALVO: Resposta = { status: 204 };

const COM_AMBOS: readonly Item[] = [ATIVO, DESATIVADO];
const SEM_O_ATIVO: readonly Item[] = [DESATIVADO];
const ATIVO_DESATIVADO: readonly Item[] = [{ ...ATIVO, ativo: false }, DESATIVADO];
const DESATIVADO_ATIVADO: readonly Item[] = [ATIVO, { ...DESATIVADO, ativo: true }];

const respostaDeProblema = (route: Route, status: number, corpo: unknown) =>
  route.fulfill({
    status,
    headers: CORS_HEADERS,
    contentType: 'application/problem+json',
    body: JSON.stringify(corpo),
  });

/** Cada POST, PUT ou DELETE consome a próxima resposta e fica retido até `liberar`. */
async function mockApi(
  page: Page,
  respostas: readonly Resposta[],
  recarga: Recarga,
  primeiraConsulta: 'ok' | 'falha' = 'ok',
) {
  let liberar: () => void = () => undefined;
  const retida = new Promise<void>((resolve) => (liberar = resolve));
  const envios: string[] = [];
  let gravou = false;
  let consultas = 0;
  const consultar = async (route: Route) => {
    consultas += 1;
    if (primeiraConsulta === 'falha' && consultas === 1) {
      await respostaDeProblema(route, 500, PROBLEMA_500);
      return;
    }
    if (gravou || consultas > 1) {
      await new Promise((resolve) => setTimeout(resolve, ATRASO_DA_RECARGA_EM_MS));
    }
    if (!gravou) {
      await route.fulfill({ status: 200, headers: CORS_HEADERS, json: COM_AMBOS });
    } else if (recarga === 'falha') {
      await respostaDeProblema(route, 500, PROBLEMA_500);
    } else {
      await route.fulfill({ status: 200, headers: CORS_HEADERS, json: recarga });
    }
  };
  const escrever = async (route: Route) => {
    const resposta = respostas[envios.length];
    envios.push(route.request().method());
    await retida;
    if (resposta.status < 300) gravou = true;
    if (resposta.corpo !== undefined) {
      await respostaDeProblema(route, resposta.status, resposta.corpo);
      return;
    }
    await route.fulfill({
      status: resposta.status,
      headers: CORS_HEADERS,
      ...(resposta.status === 201
        ? { contentType: 'application/json', body: JSON.stringify('novo-id') }
        : {}),
    });
  };
  await page.route(
    /\/api\/configuracao\/admin\/tipos-processo(\/[^?]*)?(\?.*)?$/,
    async (route) => {
      const metodo = route.request().method();
      if (metodo === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: CORS_HEADERS });
      } else if (metodo === 'GET') {
        await consultar(route);
      } else {
        await escrever(route);
      }
    },
  );
  return { liberar, envios };
}

const titulo = (page: Page): Locator =>
  page.getByRole('heading', { name: 'Tipos de processo', level: 2, exact: true });
const novo = (page: Page): Locator => page.getByRole('button', { name: 'Novo tipo de processo' });
const editar = (page: Page): Locator =>
  page.getByRole('button', { name: `Editar tipo de processo ${ATIVO.codigo}` });
const lixeira = (page: Page): Locator =>
  page.getByRole('button', { name: `Desativar tipo de processo ${ATIVO.codigo}` });
const reativar = (page: Page): Locator =>
  page.getByRole('button', { name: `Reativar tipo de processo ${DESATIVADO.codigo}` });
const drawer = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Formulário de tipo de processo' });
const confirmacaoDeDesativar = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Desativar tipo de processo', exact: true });
const confirmacaoDeReativar = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Reativar tipo de processo', exact: true });

async function abrirCadastro(page: Page): Promise<Locator> {
  await page.goto('/tipos-processo');
  await novo(page).click();
  const formulario = drawer(page);
  await expect(formulario).toBeVisible();
  await formulario.locator('input[formcontrolname="nome"]').fill('Novo tipo');
  return formulario;
}

async function abrirEdicao(page: Page): Promise<Locator> {
  await page.goto('/tipos-processo');
  await editar(page).click();
  const formulario = drawer(page);
  await expect(formulario).toBeVisible();
  return formulario;
}

async function abrirConfirmacao(page: Page, qual: 'desativar' | 'reativar') {
  await page.goto('/tipos-processo');
  await (qual === 'desativar' ? lixeira(page) : reativar(page)).click();
  const dialogo = qual === 'desativar' ? confirmacaoDeDesativar(page) : confirmacaoDeReativar(page);
  const nome = qual === 'desativar' ? 'Desativar' : 'Reativar';
  return { dialogo, confirmar: dialogo.getByRole('button', { name: nome, exact: true }) };
}

test.describe('Tipo de processo — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('criação pendente preserva foco e valores, recusa reenvio, Esc e X; a recusa foca o campo', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 422, corpo: RECUSA_DE_NOME }],
      COM_AMBOS,
    );
    const formulario = await abrirCadastro(page);
    const nome = formulario.locator('input[formcontrolname="nome"]');
    await formulario.getByRole('button', { name: 'Criar tipo de processo' }).click();
    const salvar = formulario.getByRole('button', { name: 'Salvando...' });
    await expect(nome).toBeDisabled();
    await expect(nome).toHaveValue('Novo tipo');
    await expect(salvar).toBeFocused();
    await expect(salvar).toHaveAttribute('aria-disabled', 'true');
    await expect(salvar).toHaveAttribute('aria-busy', 'true');
    await expect(salvar).toHaveCSS('cursor', 'not-allowed');
    await expect(formulario.locator('[role="status"]').first()).toContainText('Salvando');
    await expect(formulario.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(formulario).toBeVisible();
    await expect(formulario.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await salvar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(envios).toEqual(['POST']);
    liberar();
    await expect(nome).toBeEnabled();
    await expect(nome).toBeFocused();
    await expect(nome).toHaveAttribute('aria-invalid', 'true');
    await expect(formulario.getByText('Nome fora do padrão.')).toBeVisible();
    await expect(formulario.locator('[role="status"]').first()).toContainText('Revise os campos');
  });

  test('código já reservado marca o campo de código e o foca', async ({ page }) => {
    const { liberar } = await mockApi(
      page,
      [{ status: 409, corpo: PROBLEMA_409_CODIGO }],
      COM_AMBOS,
    );
    const formulario = await abrirCadastro(page);
    await formulario.getByRole('button', { name: 'Criar tipo de processo' }).click();
    liberar();
    const codigo = formulario.locator('input[formcontrolname="codigo"]');
    await expect(codigo).toBeFocused();
    await expect(codigo).toHaveAttribute('aria-invalid', 'true');
    await expect(
      formulario.getByText('Código do tipo de processo seletivo já está reservado'),
    ).toBeVisible();
  });

  test('conflito de processamento aparece no alerta e deixa o envio disponível', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 409, corpo: PROBLEMA_409_PROCESSANDO }, CRIADO],
      COM_AMBOS,
    );
    const formulario = await abrirCadastro(page);
    const enviar = formulario.getByRole('button', { name: 'Criar tipo de processo' });
    await enviar.click();
    liberar();
    await expect(formulario.locator('.alert__msg')).toContainText('Escrita em processamento');
    await expect(formulario.locator('.field.is-error')).toHaveCount(0);
    await expect(enviar).not.toHaveAttribute('aria-disabled', 'true');
    await enviar.click();
    await expect(formulario).toBeHidden();
    expect(envios).toEqual(['POST', 'POST']);
  });

  test('conflito de concorrência na edição aparece no alerta, sem marcar campo', async ({
    page,
  }) => {
    const { liberar } = await mockApi(
      page,
      [{ status: 409, corpo: PROBLEMA_409_CONCORRENCIA }],
      COM_AMBOS,
    );
    const formulario = await abrirEdicao(page);
    await formulario.getByRole('button', { name: 'Salvar tipo de processo' }).click();
    liberar();
    await expect(formulario.locator('.alert__msg')).toContainText(PROBLEMA_409_CONCORRENCIA.title);
    await expect(formulario.locator('.field.is-error')).toHaveCount(0);
  });

  test('Enter no campo leva o foco ao botão de salvar e, na falha 500, o envio segue disponível', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 500, corpo: PROBLEMA_500 }],
      COM_AMBOS,
    );
    const formulario = await abrirEdicao(page);
    const nome = formulario.locator('input[formcontrolname="nome"]');
    await nome.focus();
    await page.keyboard.press('Enter');
    await expect(nome).toBeDisabled();
    await expect(formulario.getByRole('button', { name: 'Salvando...' })).toBeFocused();
    liberar();
    await expect(formulario.locator('.alert__msg')).toBeVisible();
    await expect(nome).toBeEnabled();
    await expect(formulario.getByRole('button', { name: 'Salvar tipo de processo' })).toBeFocused();
    expect(envios).toEqual(['PUT']);
  });

  test('envio barrado localmente leva o foco ao primeiro campo inválido', async ({ page }) => {
    const { envios } = await mockApi(page, [SALVO], COM_AMBOS);
    const formulario = await abrirEdicao(page);
    const nome = formulario.locator('input[formcontrolname="nome"]');
    await nome.fill('');
    await formulario.getByRole('button', { name: 'Salvar tipo de processo' }).focus();
    await page.keyboard.press('Enter');
    await expect(nome).toBeFocused();
    await expect(nome).toHaveAttribute('aria-invalid', 'true');
    expect(envios).toEqual([]);
  });

  test('"Tentar novamente" fica focado e indisponível durante a carga e leva o foco ao título', async ({
    page,
  }) => {
    await mockApi(page, [], COM_AMBOS, 'falha');
    await page.goto('/tipos-processo');
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(editar(page)).toBeVisible();
    await expect(titulo(page)).toBeFocused();
  });

  test('edição concluída devolve o foco ao acionador depois da recarga', async ({ page }) => {
    const { liberar } = await mockApi(page, [SALVO], COM_AMBOS);
    const formulario = await abrirEdicao(page);
    await formulario.getByRole('button', { name: 'Salvar tipo de processo' }).click();
    liberar();
    await expect(formulario).toBeHidden();
    await expect(editar(page)).toBeDisabled();
    await expect(editar(page)).toBeEnabled();
    await expect(editar(page)).toBeFocused();
  });

  test('criação concluída devolve o foco ao botão de cadastro', async ({ page }) => {
    const { liberar } = await mockApi(page, [CRIADO], COM_AMBOS);
    const formulario = await abrirCadastro(page);
    await formulario.getByRole('button', { name: 'Criar tipo de processo' }).click();
    liberar();
    await expect(formulario).toBeHidden();
    await expect(novo(page)).not.toHaveAttribute('aria-disabled', 'true');
    await expect(novo(page)).toBeFocused();
  });

  test('cancelar a edição devolve o foco ao acionador', async ({ page }) => {
    await mockApi(page, [], COM_AMBOS);
    const formulario = await abrirEdicao(page);
    await formulario.getByRole('button', { name: 'Cancelar' }).click();
    await expect(formulario).toBeHidden();
    await expect(editar(page)).toBeFocused();
  });

  for (const recarga of [SEM_O_ATIVO, 'falha'] as const) {
    const situacaoDaRecarga = recarga === 'falha' ? 'com falha' : 'sem o item';
    test(`edição concluída, com a recarga ${situacaoDaRecarga}, leva o foco ao título da lista`, async ({
      page,
    }) => {
      const { liberar } = await mockApi(page, [SALVO], recarga);
      const formulario = await abrirEdicao(page);
      await formulario.getByRole('button', { name: 'Salvar tipo de processo' }).click();
      liberar();
      await expect(formulario).toBeHidden();
      await expect(titulo(page)).toBeFocused();
    });
  }

  test('desativação pendente mantém o foco no botão, recusa reenvio, Esc, X e Cancelar e anuncia o andamento', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [SALVO], SEM_O_ATIVO);
    const { dialogo, confirmar } = await abrirConfirmacao(page, 'desativar');
    await confirmar.click();
    await expect(confirmar).toBeFocused();
    await expect(confirmar).toHaveAttribute('aria-disabled', 'true');
    await expect(confirmar).toHaveAttribute('aria-busy', 'true');
    await expect(confirmar).toHaveCSS('cursor', 'not-allowed');
    await expect(dialogo.getByRole('status')).toContainText('Desativando');
    await expect(dialogo.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeVisible();
    await confirmar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(envios).toEqual(['DELETE']);
    liberar();
    await expect(dialogo).toBeHidden();
  });

  test('desativação concluída, com o tipo ainda na lista, leva o foco ao botão de reativar da linha', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [SALVO], ATIVO_DESATIVADO);
    const { dialogo, confirmar } = await abrirConfirmacao(page, 'desativar');
    await confirmar.click();
    liberar();
    await expect(dialogo).toBeHidden();
    await expect(
      page.getByRole('button', { name: `Reativar tipo de processo ${ATIVO.codigo}` }),
    ).toBeFocused();
  });

  for (const recarga of [SEM_O_ATIVO, 'falha'] as const) {
    const situacaoDaRecarga = recarga === 'falha' ? 'com falha' : 'sem o item';
    test(`desativação concluída, com a recarga ${situacaoDaRecarga}, leva o foco ao título da lista`, async ({
      page,
    }) => {
      const { liberar } = await mockApi(page, [SALVO], recarga);
      const { dialogo, confirmar } = await abrirConfirmacao(page, 'desativar');
      await confirmar.click();
      liberar();
      await expect(dialogo).toBeHidden();
      await expect(titulo(page)).toBeFocused();
    });
  }

  for (const recusa of [
    { status: 422, corpo: PROBLEMA_422_JA_DESATIVADO },
    { status: 409, corpo: PROBLEMA_409_CONCORRENCIA_NA_REMOCAO },
    { status: 500, corpo: PROBLEMA_500 },
  ]) {
    test(`desativação recusada (${recusa.status}) mantém o diálogo, a mensagem e o foco no botão, que volta a aceitar o clique`, async ({
      page,
    }) => {
      const { liberar, envios } = await mockApi(page, [recusa, SALVO], SEM_O_ATIVO);
      const { dialogo, confirmar } = await abrirConfirmacao(page, 'desativar');
      await confirmar.click();
      liberar();
      const mensagem = dialogo.locator('.field__error');
      await expect(mensagem).toContainText(recusa.corpo.title);
      await expect(confirmar).not.toHaveAttribute('aria-disabled', 'true');
      await expect(confirmar).toBeFocused();
      await expect(dialogo.getByRole('status')).toContainText('Não foi possível desativar');
      await confirmar.click();
      await expect(mensagem).toBeHidden();
      await expect(dialogo).toBeHidden();
      expect(envios).toEqual(['DELETE', 'DELETE']);
    });
  }

  test('reativação pendente mantém o foco no botão, recusa reenvio, Esc e Cancelar e anuncia o andamento', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [SALVO], DESATIVADO_ATIVADO);
    const { dialogo, confirmar } = await abrirConfirmacao(page, 'reativar');
    await confirmar.click();
    await expect(confirmar).toBeFocused();
    await expect(confirmar).toHaveAttribute('aria-disabled', 'true');
    await expect(confirmar).toHaveCSS('cursor', 'not-allowed');
    await expect(dialogo.getByRole('status')).toContainText('Reativando');
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeVisible();
    await confirmar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    expect(envios).toEqual(['POST']);
    liberar();
    await expect(dialogo).toBeHidden();
  });

  test('reativação concluída leva o foco ao botão de desativar da linha', async ({ page }) => {
    const { liberar } = await mockApi(page, [SALVO], DESATIVADO_ATIVADO);
    const { dialogo, confirmar } = await abrirConfirmacao(page, 'reativar');
    await confirmar.click();
    liberar();
    await expect(dialogo).toBeHidden();
    await expect(
      page.getByRole('button', { name: `Desativar tipo de processo ${DESATIVADO.codigo}` }),
    ).toBeFocused();
  });

  for (const recusa of [
    { status: 422, corpo: PROBLEMA_422_JA_ATIVO },
    { status: 409, corpo: PROBLEMA_409_PROCESSANDO },
  ]) {
    test(`reativação recusada (${recusa.status}) mantém o diálogo, a mensagem e o foco no botão`, async ({
      page,
    }) => {
      const { liberar, envios } = await mockApi(page, [recusa, SALVO], DESATIVADO_ATIVADO);
      const { dialogo, confirmar } = await abrirConfirmacao(page, 'reativar');
      await confirmar.click();
      liberar();
      await expect(dialogo.locator('.field__error')).toContainText(recusa.corpo.title);
      await expect(confirmar).not.toHaveAttribute('aria-disabled', 'true');
      await expect(confirmar).toBeFocused();
      await expect(dialogo.getByRole('status')).toContainText('Não foi possível reativar');
      await confirmar.click();
      await expect(dialogo).toBeHidden();
      expect(envios).toEqual(['POST', 'POST']);
    });
  }

  test('cancelar a confirmação devolve o foco ao botão de desativar da linha', async ({ page }) => {
    await mockApi(page, [], SEM_O_ATIVO);
    const { dialogo } = await abrirConfirmacao(page, 'desativar');
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();
    await expect(lixeira(page)).toBeFocused();
  });

  test('cancelar a confirmação de reativação devolve o foco ao botão de reativar da linha', async ({
    page,
  }) => {
    await mockApi(page, [], DESATIVADO_ATIVADO);
    const { dialogo } = await abrirConfirmacao(page, 'reativar');
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();
    await expect(reativar(page)).toBeFocused();
  });
});
