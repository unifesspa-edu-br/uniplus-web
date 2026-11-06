import { expect, test, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

/**
 * Escritas de Oferta de curso num navegador real: com o envio em curso o formulário é só leitura
 * e não fecha; com a remoção em curso o diálogo segue aberto; e o foco vai ao campo recusado, volta
 * ao acionador ou, sem a linha, ao título da lista. API mockada por `page.route`; autenticação real
 * pelo projeto `fluxo-chromium`.
 */

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const CURSO = {
  id: '01960000-0000-7000-0000-0000000000c1',
  codigo: 'ENG-CIV',
  nome: 'Engenharia Civil',
  grau: 'Bacharelado',
  nivelEnsino: 'Graduação',
  grupoAreaEnem: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

const LOCAL = {
  id: '01960000-0000-7000-0000-0000000000e1',
  tipo: 'campusSede',
  campusResponsavelId: null,
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
  codigoEmec: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

const UNIDADE = {
  id: '01960000-0000-7000-0000-0000000000f1',
  nome: 'Instituto de Geociências e Engenharias',
  alias: null,
  slug: 'ige',
  sigla: 'IGE',
  codigo: 'IGE',
  unidadeSuperiorId: null,
  tipo: 'Instituto',
  unidadeAcademica: true,
  vigenciaInicio: '2020-01-01',
  vigenciaFim: null,
};

const OFERTA = {
  id: '01960000-0000-7000-0000-0000000000d1',
  cursoId: CURSO.id,
  localOfertaId: LOCAL.id,
  unidadeOfertante: {
    origemId: UNIDADE.id,
    sigla: 'IGE',
    nome: UNIDADE.nome,
    tipo: 'Instituto',
  },
  programaDeOferta: 'REGULAR',
  formatoPedagogico: 'PRESENCIAL',
  regimeDeFuncionamento: 'EXTENSIVO',
  regimeDeTurno: 'REGULAR',
  turnos: ['MATUTINO'],
  eMecCodigo: '123456',
  codigoSga: null,
  vagasAnuaisAutorizadas: 40,
  baseLegal: null,
  atoAutorizacaoMec: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

const IDENTIFICADOR = 'Engenharia Civil · IGE · Campus sede — Marabá · Regular · Matutino';

/** Atraso da recarga da lista após a escrita: o botão da linha ainda está indisponível quando o drawer fecha. */
const ATRASO_DA_RECARGA_EM_MS = 1500;

const ERRO_INTERNO = {
  type: 'about:blank',
  title: 'Erro interno',
  status: 500,
  code: 'uniplus.internal.unexpected',
};

const SEM_PERMISSAO = {
  type: 'about:blank',
  title: 'Sem permissão',
  status: 403,
  code: 'uniplus.auth.forbidden',
};

const PREFIXO_DO_CODIGO = 'uniplus.configuracao.oferta_curso.';

/** A recusa de validação como o endpoint a emite: `errors[]` com o campo em camelCase. */
function recusaDeCampos(...erros: { field: string; code: string; message: string }[]) {
  return {
    type: 'about:blank',
    title: erros[0].message,
    status: 422,
    code: `${PREFIXO_DO_CODIGO}${erros[0].code}`,
    errors: erros.map((erro) => ({ ...erro, code: `${PREFIXO_DO_CODIGO}${erro.code}` })),
  };
}

const RECUSA_DE_CODIGO = recusaDeCampos(
  { field: 'eMecCodigo', code: 'e_mec_codigo_tamanho', message: 'Código e-MEC fora do padrão.' },
  { field: 'codigoSga', code: 'codigo_sga_tamanho', message: 'Código SGA fora do padrão.' },
);

async function responder(route: Route, status: number, corpo?: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: status >= 400 ? 'application/problem+json' : 'application/json',
    headers: CORS_HEADERS,
    body: status === 204 || corpo === undefined ? undefined : JSON.stringify(corpo),
  });
}

type Recarga = 'com-a-oferta' | 'sem-a-oferta' | 'com-falha';

async function mockApi(
  page: Page,
  resposta: { status: number; corpo?: unknown },
  recarga: Recarga = 'com-a-oferta',
  primeiraConsulta: 'ok' | 'falha' = 'ok',
) {
  let liberar: () => void = () => undefined;
  const retida = new Promise<void>((resolve) => (liberar = resolve));
  const envios: string[] = [];
  let consultas = 0;
  await page.route(/\/api\/configuracao\/cursos(\?.*)?$/, (r) => responder(r, 200, [CURSO]));
  await page.route(/\/api\/configuracao\/locais-oferta(\?.*)?$/, (r) => responder(r, 200, [LOCAL]));
  await page.route(/\/api\/organizacao\/unidades(\?.*)?$/, (r) => responder(r, 200, [UNIDADE]));
  await page.route(/\/api\/configuracao\/ofertas-curso(\?.*)?$/, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    consultas += 1;
    if (primeiraConsulta === 'falha' && consultas === 1) {
      await responder(route, 500, ERRO_INTERNO);
      return;
    }
    if (consultas > 1) await new Promise((resolve) => setTimeout(resolve, ATRASO_DA_RECARGA_EM_MS));
    if (consultas > 1 && recarga === 'com-falha') {
      await responder(route, 500, ERRO_INTERNO);
      return;
    }
    await responder(route, 200, consultas > 1 && recarga === 'sem-a-oferta' ? [] : [OFERTA]);
  });
  await page.route(/\/api\/configuracao\/admin\/ofertas-curso(\/[^/?]+)?$/, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    envios.push(route.request().method());
    await retida;
    await responder(route, resposta.status, resposta.corpo);
  });
  return { liberar, envios };
}

async function preencherCadastro(page: Page): Promise<void> {
  await page.locator('#cfg-oferta-curso-id').selectOption(CURSO.id);
  await page.locator('#cfg-oferta-local-id').selectOption(LOCAL.id);
  await page.locator('#cfg-oferta-unidade-id').selectOption(UNIDADE.id);
  await page.locator('label.checkbox', { hasText: 'Matutino' }).click();
}

const tituloDaLista = (page: Page) =>
  page.getByRole('heading', { name: 'Ofertas de curso', level: 2 });
const formulario = (page: Page) =>
  page.getByRole('dialog', { name: 'Formulário de oferta de curso' });
const confirmacao = (page: Page) => page.getByRole('dialog', { name: 'Remover oferta de curso' });
const editar = (page: Page) =>
  page.getByRole('button', { name: `Editar oferta de curso ${IDENTIFICADOR}`, exact: true });
const remover = (page: Page) =>
  page.getByRole('button', { name: `Remover oferta de curso ${IDENTIFICADOR}`, exact: true });
const novo = (page: Page) => page.locator('#cfg-ofertas-novo');

test.describe('Oferta de curso — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('envio pendente deixa o formulário só leitura, sem reenvio, e a recusa leva o foco ao campo', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, { status: 422, corpo: RECUSA_DE_CODIGO });
    await page.goto('/ofertas-curso');
    await novo(page).click();
    const drawer = formulario(page);
    await preencherCadastro(page);

    await drawer.getByRole('button', { name: 'Criar oferta' }).focus();
    await drawer.getByRole('button', { name: 'Criar oferta' }).click();

    const eMec = page.locator('input[formcontrolname="eMecCodigo"]');
    const salvar = drawer.getByRole('button', { name: 'Salvando...' });
    await expect(eMec).toBeDisabled();
    await expect(page.locator('#cfg-oferta-curso-id')).toBeDisabled();
    await expect(salvar).toBeFocused();
    await expect(salvar).toHaveAttribute('aria-disabled', 'true');
    await expect(salvar).toHaveAttribute('aria-busy', 'true');
    await expect(salvar).toHaveCSS('cursor', 'not-allowed');
    await expect(drawer.locator('[role="status"]').first()).toContainText('Salvando');
    await expect(drawer.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await expect(drawer.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeVisible();
    await salvar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await page.evaluate(() => new Promise((resolver) => requestAnimationFrame(resolver)));
    expect(envios).toEqual(['POST']);

    liberar();
    await expect(eMec).toBeEnabled();
    await expect(eMec).toBeFocused();
    await expect(eMec).toHaveAttribute('aria-invalid', 'true');
    await expect(drawer.locator('.field__error')).toHaveText([
      'Código e-MEC fora do padrão.',
      'Código SGA fora do padrão.',
    ]);
    await expect(page.locator('input[formcontrolname="codigoSga"]')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    await expect(drawer.locator('[role="status"]').first()).toContainText('Revise os campos');
  });

  test('recusa de turnos leva o foco ao primeiro turno, com a mensagem associada', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, {
      status: 422,
      corpo: recusaDeCampos({
        field: 'turnos',
        code: 'cardinalidade_turnos_incompativel_com_regime',
        message: 'Turnos incompatíveis com o regime.',
      }),
    });
    await page.goto('/ofertas-curso');
    await novo(page).click();
    const drawer = formulario(page);
    await preencherCadastro(page);
    await drawer.getByRole('button', { name: 'Criar oferta' }).click();
    liberar();

    const matutino = page.getByRole('checkbox', { name: 'Matutino' });
    await expect(matutino).toBeFocused();
    await expect(matutino).toHaveAttribute('aria-invalid', 'true');
    await expect(matutino).toHaveAttribute('aria-describedby', /cfg-oferta-turnos-erro/);
    await expect(drawer.locator('#cfg-oferta-turnos-erro')).toHaveText(
      'Turnos incompatíveis com o regime.',
    );
  });

  test('Enter num campo leva o foco ao botão de salvar e, na falha 500, o envio segue disponível', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, { status: 500, corpo: ERRO_INTERNO });
    await page.goto('/ofertas-curso');
    await novo(page).click();
    const drawer = formulario(page);
    await preencherCadastro(page);
    const eMec = page.locator('input[formcontrolname="eMecCodigo"]');
    await eMec.focus();
    await page.keyboard.press('Enter');

    await expect(eMec).toBeDisabled();
    await expect(drawer.getByRole('button', { name: 'Salvando...' })).toBeFocused();
    liberar();
    await expect(drawer.locator('ui-alert').first()).toContainText('Erro interno');
    await expect(eMec).toBeEnabled();
    await expect(drawer.getByRole('button', { name: 'Criar oferta' })).toBeFocused();
    expect(envios).toEqual(['POST']);
  });

  test('envio barrado localmente leva o foco ao primeiro campo inválido', async ({ page }) => {
    const { envios } = await mockApi(page, { status: 201, corpo: 'novo-id' });
    await page.goto('/ofertas-curso');
    await novo(page).click();
    const drawer = formulario(page);
    await drawer.getByRole('button', { name: 'Criar oferta' }).focus();
    await page.keyboard.press('Enter');

    const curso = page.locator('#cfg-oferta-curso-id');
    await expect(curso).toBeFocused();
    await expect(curso).toHaveAttribute('aria-invalid', 'true');
    expect(envios).toEqual([]);
  });

  test('cadastro concluído devolve o foco ao botão que abriu o drawer, mesmo com a recarga atrasada', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, { status: 201, corpo: 'novo-id' });
    await page.goto('/ofertas-curso');
    const acionador = novo(page);
    await acionador.focus();
    await acionador.click();
    const drawer = formulario(page);
    await preencherCadastro(page);
    await drawer.getByRole('button', { name: 'Criar oferta' }).click();

    liberar();
    await expect(drawer).toBeHidden();
    await expect(acionador).toBeFocused();
  });

  test('edição concluída devolve o foco ao botão de editar da linha', async ({ page }) => {
    const { liberar, envios } = await mockApi(page, { status: 204 });
    await page.goto('/ofertas-curso');
    await editar(page).click();
    const drawer = formulario(page);
    await drawer.getByRole('button', { name: 'Salvar oferta' }).click();
    liberar();

    await expect(drawer).toBeHidden();
    await expect(editar(page)).toBeFocused();
    expect(envios).toEqual(['PUT']);
  });

  test('cancelar a edição devolve o foco ao botão que abriu o drawer', async ({ page }) => {
    const { envios } = await mockApi(page, { status: 204 });
    await page.goto('/ofertas-curso');
    await editar(page).click();
    const drawer = formulario(page);
    await drawer.getByRole('button', { name: 'Cancelar' }).click();

    await expect(drawer).toBeHidden();
    await expect(editar(page)).toBeFocused();
    expect(envios).toEqual([]);
  });

  test('edição concluída, com falha na recarga, leva o foco ao título da lista', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, { status: 204 }, 'com-falha');
    await page.goto('/ofertas-curso');
    await editar(page).click();
    const drawer = formulario(page);
    await drawer.getByRole('button', { name: 'Salvar oferta' }).click();
    liberar();

    await expect(drawer).toBeHidden();
    await expect(tituloDaLista(page)).toBeFocused();
    await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
  });

  test('remoção pendente mantém o diálogo, anuncia o andamento e não reenvia', async ({ page }) => {
    const { liberar, envios } = await mockApi(page, { status: 204 });
    await page.goto('/ofertas-curso');
    await remover(page).click();
    const dialogo = confirmacao(page);
    const confirmar = dialogo.getByRole('button', { name: 'Remover', exact: true });
    await confirmar.click();

    await expect(confirmar).toBeFocused();
    await expect(confirmar).toHaveAttribute('aria-disabled', 'true');
    await expect(confirmar).toHaveCSS('cursor', 'not-allowed');
    await expect(dialogo.locator('[role="status"]')).toContainText(
      'Removendo a oferta de curso ENG-CIV — Engenharia Civil.',
    );
    await expect(dialogo.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeVisible();
    await confirmar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await page.evaluate(() => new Promise((resolver) => requestAnimationFrame(resolver)));
    expect(envios).toEqual(['DELETE']);

    liberar();
    await expect(dialogo).toBeHidden();
  });

  test('remoção concluída, com a linha ausente da recarga, leva o foco ao título e anuncia o desfecho', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, { status: 204 }, 'sem-a-oferta');
    await page.goto('/ofertas-curso');
    await remover(page).click();
    const dialogo = confirmacao(page);
    await dialogo.getByRole('button', { name: 'Remover', exact: true }).click();
    liberar();

    await expect(dialogo).toBeHidden();
    await expect(tituloDaLista(page)).toBeFocused();
    await expect(
      page.locator('.sr-only[role="status"]').filter({ hasText: 'Oferta de curso' }),
    ).toHaveText('Oferta de curso ENG-CIV — Engenharia Civil removida.');
  });

  test('remoção recusada por falha interna mantém o diálogo aberto e o foco dentro dele', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, { status: 500, corpo: ERRO_INTERNO });
    await page.goto('/ofertas-curso');
    await remover(page).click();
    const dialogo = confirmacao(page);
    const confirmar = dialogo.getByRole('button', { name: 'Remover', exact: true });
    await confirmar.click();
    liberar();

    await expect(dialogo.locator('.field__error')).toHaveText('Erro interno');
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
    await expect(confirmar).toBeFocused();
    await expect(tituloDaLista(page)).not.toBeFocused();
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(remover(page)).toBeFocused();
  });

  test('remoção recusada por falta de permissão leva à página de acesso negado', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, { status: 403, corpo: SEM_PERMISSAO });
    await page.goto('/ofertas-curso');
    await remover(page).click();
    const dialogo = confirmacao(page);
    await dialogo.getByRole('button', { name: 'Remover', exact: true }).click();
    liberar();

    await expect(page).toHaveURL(/\/acesso-negado$/);
    await expect(dialogo).toBeHidden();
  });

  test('remoção com recarga que falha leva o foco ao título da lista', async ({ page }) => {
    const { liberar } = await mockApi(page, { status: 204 }, 'com-falha');
    await page.goto('/ofertas-curso');
    await remover(page).click();
    const dialogo = confirmacao(page);
    await dialogo.getByRole('button', { name: 'Remover', exact: true }).click();
    liberar();

    await expect(dialogo).toBeHidden();
    await expect(tituloDaLista(page)).toBeFocused();
    await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
  });

  test('"Tentar novamente" fica focado e indisponível durante a carga e leva o foco ao título', async ({
    page,
  }) => {
    await mockApi(page, { status: 204 }, 'com-a-oferta', 'falha');
    await page.goto('/ofertas-curso');
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();

    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(editar(page)).toBeVisible();
    await expect(tituloDaLista(page)).toBeFocused();
  });
});
