import { expect, test, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

/**
 * Escritas de Curso num navegador real: com o envio em curso o formulário é só leitura e não
 * fecha; com a remoção em curso o diálogo segue aberto; e o foco vai ao campo recusado, volta ao
 * acionador ou, sem a linha, ao título da lista. API mockada por `page.route`; autenticação real
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

const OFERTA = {
  id: '01960000-0000-7000-0000-0000000000f1',
  cursoId: CURSO.id,
  unidadeOfertante: {
    origemId: 'u1',
    sigla: 'IGE',
    nome: 'Instituto de Geociências',
    tipo: 'Instituto',
  },
  programaDeOferta: 'REGULAR',
  regimeDeTurno: 'REGULAR',
  turnos: ['MATUTINO'],
};

/** Atraso da recarga da lista após a escrita: o botão da linha ainda está indisponível quando o drawer fecha. */
const ATRASO_DA_RECARGA_EM_MS = 1500;

const BLOQUEIO = 'Não é possível remover um curso referenciado por uma oferta de curso ativa';

const ERRO_INTERNO = {
  type: 'about:blank',
  title: 'Erro interno',
  status: 500,
  code: 'uniplus.internal.unexpected',
};

async function responder(route: Route, status: number, corpo?: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: status >= 400 ? 'application/problem+json' : 'application/json',
    headers: CORS_HEADERS,
    body: status === 204 || corpo === undefined ? undefined : JSON.stringify(corpo),
  });
}

type Recarga = 'com-o-curso' | 'sem-o-curso' | 'com-falha';

async function mockApi(
  page: Page,
  resposta: { status: number; corpo?: unknown },
  recarga: Recarga = 'com-o-curso',
  primeiraConsulta: 'ok' | 'falha' = 'ok',
) {
  let liberar: () => void = () => undefined;
  const retida = new Promise<void>((resolve) => (liberar = resolve));
  const envios: string[] = [];
  let consultas = 0;
  await page.route(/\/api\/configuracao\/vocabularios\/grupos-area-enem$/, (r) =>
    responder(r, 200, []),
  );
  await page.route(/\/api\/configuracao\/ofertas-curso(\?.*)?$/, (r) =>
    responder(r, 200, [OFERTA]),
  );
  await page.route(/\/api\/configuracao\/cursos(\?.*)?$/, async (route) => {
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
    await responder(route, 200, consultas > 1 && recarga === 'sem-o-curso' ? [] : [CURSO]);
  });
  await page.route(/\/api\/configuracao\/admin\/cursos(\/[^/?]+)?$/, async (route) => {
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

async function preencher(page: Page): Promise<void> {
  await page.locator('input[formcontrolname="codigo"]').fill('DIR');
  await page.locator('input[formcontrolname="nome"]').fill('Direito');
  await page.locator('input[formcontrolname="grau"]').fill('Bacharelado');
  await page.locator('input[formcontrolname="nivelEnsino"]').fill('Graduação');
}

const tituloDaLista = (page: Page) => page.getByRole('heading', { name: 'Cursos', level: 2 });
const formulario = (page: Page) => page.getByRole('dialog', { name: 'Formulário de curso' });
const confirmacao = (page: Page) => page.getByRole('dialog', { name: 'Remover curso' });
const editar = (page: Page) => page.getByRole('button', { name: 'Editar curso ENG-CIV' });
const remover = (page: Page) => page.getByRole('button', { name: 'Remover curso ENG-CIV' });

test.describe('Curso — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('envio pendente deixa o formulário só leitura, sem reenvio, e a recusa leva o foco ao campo', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, {
      status: 422,
      corpo: {
        type: 'about:blank',
        title: 'Dados inválidos',
        status: 422,
        code: 'uniplus.validacao',
        traceId: 'e2e',
        errors: [
          {
            field: 'Nome',
            code: 'uniplus.configuracao.curso.nome_tamanho',
            message: 'Nome fora do padrão.',
          },
        ],
      },
    });
    await page.goto('/cursos');
    await page.locator('#cfg-cursos-novo').click();
    const drawer = formulario(page);
    await preencher(page);

    await drawer.getByRole('button', { name: 'Criar curso' }).focus();
    await drawer.getByRole('button', { name: 'Criar curso' }).click();

    const nome = page.locator('input[formcontrolname="nome"]');
    const salvar = drawer.getByRole('button', { name: 'Salvando...' });
    await expect(nome).toBeDisabled();
    await expect(nome).toHaveValue('Direito');
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
    await expect(nome).toBeEnabled();
    await expect(nome).toBeFocused();
    await expect(nome).toHaveAttribute('aria-invalid', 'true');
    await expect(drawer.locator('.field__error')).toHaveText('Nome fora do padrão.');
    await expect(drawer.locator('[role="status"]').first()).toContainText('Revise os campos');
  });

  test('Enter num campo leva o foco ao botão de salvar e, na falha 500, o envio segue disponível', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, { status: 500, corpo: ERRO_INTERNO });
    await page.goto('/cursos');
    await page.locator('#cfg-cursos-novo').click();
    const drawer = formulario(page);
    await preencher(page);
    const nome = page.locator('input[formcontrolname="nome"]');
    await nome.focus();
    await page.keyboard.press('Enter');

    await expect(nome).toBeDisabled();
    await expect(drawer.getByRole('button', { name: 'Salvando...' })).toBeFocused();
    liberar();
    await expect(drawer.locator('ui-alert').first()).toContainText('Erro interno');
    await expect(nome).toBeEnabled();
    await expect(drawer.getByRole('button', { name: 'Criar curso' })).toBeFocused();
    expect(envios).toEqual(['POST']);
  });

  test('envio barrado localmente leva o foco ao primeiro campo inválido', async ({ page }) => {
    const { envios } = await mockApi(page, { status: 201, corpo: 'novo-id' });
    await page.goto('/cursos');
    await page.locator('#cfg-cursos-novo').click();
    const drawer = formulario(page);
    await preencher(page);
    const nome = page.locator('input[formcontrolname="nome"]');
    await nome.fill('');
    await drawer.getByRole('button', { name: 'Criar curso' }).focus();
    await page.keyboard.press('Enter');

    await expect(nome).toBeFocused();
    await expect(nome).toHaveAttribute('aria-invalid', 'true');
    expect(envios).toEqual([]);
  });

  test('cadastro concluído devolve o foco ao botão que abriu o drawer, mesmo com a recarga atrasada', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, { status: 201, corpo: 'novo-id' });
    await page.goto('/cursos');
    const acionador = page.locator('#cfg-cursos-novo');
    await acionador.focus();
    await acionador.click();
    const drawer = formulario(page);
    await preencher(page);
    await drawer.getByRole('button', { name: 'Criar curso' }).click();

    liberar();
    await expect(drawer).toBeHidden();
    await expect(acionador).toBeFocused();
  });

  test('edição concluída devolve o foco ao botão de editar da linha', async ({ page }) => {
    const { liberar, envios } = await mockApi(page, { status: 204 });
    await page.goto('/cursos');
    await editar(page).click();
    const drawer = formulario(page);
    await drawer.getByRole('button', { name: 'Salvar curso' }).click();
    liberar();

    await expect(drawer).toBeHidden();
    await expect(editar(page)).toBeFocused();
    expect(envios).toEqual(['PUT']);
  });

  test('cancelar a edição devolve o foco ao botão que abriu o drawer', async ({ page }) => {
    const { envios } = await mockApi(page, { status: 204 });
    await page.goto('/cursos');
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
    await page.goto('/cursos');
    await editar(page).click();
    const drawer = formulario(page);
    await drawer.getByRole('button', { name: 'Salvar curso' }).click();
    liberar();

    await expect(drawer).toBeHidden();
    await expect(tituloDaLista(page)).toBeFocused();
    await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
  });

  test('remoção pendente mantém o diálogo, anuncia o andamento e não reenvia', async ({ page }) => {
    const { liberar, envios } = await mockApi(page, { status: 204 });
    await page.goto('/cursos');
    await remover(page).click();
    const dialogo = confirmacao(page);
    const confirmar = dialogo.getByRole('button', { name: 'Remover', exact: true });
    await confirmar.click();

    await expect(confirmar).toBeFocused();
    await expect(confirmar).toHaveAttribute('aria-disabled', 'true');
    await expect(confirmar).toHaveCSS('cursor', 'not-allowed');
    await expect(dialogo.locator('[role="status"]')).toContainText('Removendo o curso ENG-CIV');
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
    const { liberar } = await mockApi(page, { status: 204 }, 'sem-o-curso');
    await page.goto('/cursos');
    await remover(page).click();
    const dialogo = confirmacao(page);
    await dialogo.getByRole('button', { name: 'Remover', exact: true }).click();
    liberar();

    await expect(dialogo).toBeHidden();
    await expect(tituloDaLista(page)).toBeFocused();
    await expect(page.locator('.sr-only[role="status"]').first()).toHaveText(
      'Curso ENG-CIV removido.',
    );
  });

  test('remoção recusada por falha interna mantém o diálogo aberto e o foco dentro dele', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, { status: 500, corpo: ERRO_INTERNO });
    await page.goto('/cursos');
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

  test('remoção bloqueada por oferta viva abre as ofertas com o motivo e devolve o foco à lixeira', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, {
      status: 409,
      corpo: {
        type: 'about:blank',
        title: BLOQUEIO,
        status: 409,
        code: 'uniplus.configuracao.curso.remocao_bloqueada_por_oferta_curso',
      },
    });
    await page.goto('/cursos');
    await remover(page).click();
    const dialogo = confirmacao(page);
    await dialogo.getByRole('button', { name: 'Remover', exact: true }).click();
    liberar();

    const ofertas = page.getByRole('dialog', { name: /Ofertas/ });
    await expect(dialogo).toBeHidden();
    await expect(ofertas).toBeVisible();
    await expect(ofertas.getByText(BLOQUEIO)).toBeVisible();
    await expect(ofertas.getByText('IGE')).toBeVisible();

    await ofertas.getByRole('button', { name: 'Fechar' }).click();
    await expect(ofertas).toBeHidden();
    await expect(remover(page)).toBeFocused();
  });

  test('"Tentar novamente" fica focado e indisponível durante a carga e leva o foco ao título', async ({
    page,
  }) => {
    await mockApi(page, { status: 204 }, 'com-o-curso', 'falha');
    await page.goto('/cursos');
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();

    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(editar(page)).toBeVisible();
    await expect(tituloDaLista(page)).toBeFocused();
  });

  test('"Tentar novamente" das ofertas fica indisponível durante a carga e leva o foco ao Fechar', async ({
    page,
  }) => {
    await mockApi(page, { status: 204 });
    let consultas = 0;
    await page.route(/\/api\/configuracao\/ofertas-curso(\?.*)?$/, async (route) => {
      consultas += 1;
      if (consultas === 1) {
        await responder(route, 500, ERRO_INTERNO);
        return;
      }
      await new Promise((resolver) => setTimeout(resolver, ATRASO_DA_RECARGA_EM_MS));
      await responder(route, 200, [OFERTA]);
    });
    await page.goto('/cursos');
    await page.getByRole('button', { name: 'Ofertas de ENG-CIV', exact: true }).click();
    const ofertas = page.getByRole('dialog', { name: /Ofertas/ });
    const tentar = ofertas.getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();

    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(ofertas.getByText('IGE')).toBeVisible();
    await expect(tentar).toBeHidden();
    await expect(ofertas.getByRole('button', { name: 'Fechar' })).toBeFocused();
  });

  test('a busca é limitada a 200 caracteres, o que a API aceita', async ({ page }) => {
    await mockApi(page, { status: 204 });
    await page.goto('/cursos');
    await expect(page.getByRole('searchbox', { name: 'Buscar curso' })).toHaveAttribute(
      'maxlength',
      '200',
    );
  });
});
