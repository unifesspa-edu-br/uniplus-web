import { expect, test, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const ID_DO_MODELO = '01960000-0000-7000-0000-0000000000a1';
const MODELO = {
  id: ID_DO_MODELO,
  codigo: 'INSCRICAO',
  nome: 'Inscrição',
  descricao: null,
  finalidade: 'INSCRICAO',
  tipoProcessoCodigo: null,
  ativo: true,
  conteudo: {
    titulo: 'Inscrição',
    etapas: [],
    itens: [],
    termos: [],
    pressupostos: [],
    grupos: [],
    documentosExigidos: [],
  },
};
const NOME_GRAVADO = 'Inscrição revisada';

/** Atraso da releitura do modelo após a gravação: a tela ainda espera por ela quando o PUT termina. */
const ATRASO_DA_RECARGA_EM_MS = 1500;

async function responder(
  route: Route,
  status: number,
  corpo?: unknown,
  contentType = 'application/json',
): Promise<void> {
  await route.fulfill({
    status,
    headers: CORS_HEADERS,
    ...(corpo === undefined ? {} : { contentType, body: JSON.stringify(corpo) }),
  });
}

/**
 * O PUT fica retido até `liberar`; depois dele, a releitura demora e devolve o nome gravado, ou
 * responde 500 quando `releituraFalha`.
 */
async function mockApi(page: Page, releituraFalha = false) {
  let liberar: () => void = () => undefined;
  const retida = new Promise<void>((resolve) => (liberar = resolve));
  let gravado = false;
  await page.route(
    /\/api\/configuracao\/(tipos-processo|fatos-candidato|fases-canonicas|tipos-documento|termos-consentimento)(\?.*)?$/,
    (route) => responder(route, 200, []),
  );
  await page.route(/\/api\/configuracao\/admin\/modelos-formulario\/[^/?]+$/, async (route) => {
    const metodo = route.request().method();
    if (metodo === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    if (metodo === 'PUT') {
      await retida;
      gravado = true;
      await responder(route, 204);
      return;
    }
    if (gravado) {
      await new Promise((resolve) => setTimeout(resolve, ATRASO_DA_RECARGA_EM_MS));
    }
    if (gravado && releituraFalha) {
      await responder(
        route,
        500,
        {
          type: 'https://uniplus.dev/erros/uniplus.infra.erro_interno',
          status: 500,
          title: 'Erro interno',
          code: 'uniplus.infra.erro_interno',
        },
        'application/problem+json',
      );
      return;
    }
    await responder(route, 200, { ...MODELO, nome: gravado ? NOME_GRAVADO : MODELO.nome });
  });
  return { liberar };
}

test.describe('Modelo de formulário — edição', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('Enter no nome leva o foco ao botão de salvar, que o mantém durante o envio', async ({
    page,
  }) => {
    await mockApi(page);
    await page.goto(`/modelos-formulario/${ID_DO_MODELO}`);
    const nome = page.locator('input[formcontrolname="nome"]');
    await nome.focus();

    await page.keyboard.press('Enter');

    const salvar = page.getByRole('button', { name: 'Salvando...' });
    await expect(nome).toBeDisabled();
    await expect(salvar).toBeFocused();
    await expect(salvar).toHaveAttribute('aria-disabled', 'true');
  });

  test('gravado o modelo, o formulário fica somente leitura até a releitura e o foco segue no botão', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page);
    await page.goto(`/modelos-formulario/${ID_DO_MODELO}`);
    const nome = page.locator('input[formcontrolname="nome"]');
    await nome.fill(NOME_GRAVADO);
    await nome.focus();
    await page.keyboard.press('Enter');
    const salvar = page.getByRole('button', { name: 'Salvando...' });
    await expect(salvar).toBeFocused();

    liberar();

    const botao = page.getByRole('button', { name: 'Salvar modelo' });
    await expect(botao).toHaveAttribute('aria-disabled', 'true');
    await expect(botao).toBeFocused();
    await expect(nome).toBeVisible();
    await expect(nome).toBeDisabled();
    await expect(page.getByText('Carregando o modelo...')).toHaveCount(0);

    await expect(nome).toBeEnabled();
    await expect(nome).toHaveValue(NOME_GRAVADO);
    await expect(botao).not.toHaveAttribute('aria-disabled', 'true');
    await expect(botao).toBeFocused();
  });

  test('gravado o modelo e falha a releitura, o foco vai ao título que o alerta não leva', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, true);
    await page.goto(`/modelos-formulario/${ID_DO_MODELO}`);
    const nome = page.locator('input[formcontrolname="nome"]');
    await nome.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Salvando...' })).toBeFocused();

    liberar();

    await expect(page.getByText('Não foi possível carregar o modelo')).toBeVisible();
    await expect(page.getByText('Erro interno')).toBeVisible();
    await expect(nome).toHaveCount(0);
    await expect(page.locator('#cfg-modelo-titulo')).toBeFocused();
  });
});
