import { expect, test, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const FASE = {
  id: '01960000-0000-7000-0000-0000000000f1',
  codigo: 'AVALIACAO',
  nome: 'Avaliação',
  descricao: null,
  unidadeSugerida: null,
  agrupaEtapas: true,
  permiteComplementacao: false,
  baseLegal: null,
  coletaInscricao: false,
  coletaSolicitacaoIsencao: false,
  origemData: 'NO_EDITAL',
  criadoEm: '2026-06-10T12:00:00Z',
};

/** Atraso da recarga da lista após a escrita: o botão da linha ainda está indisponível quando o drawer fecha. */
const ATRASO_DA_RECARGA_EM_MS = 1500;

const ERRO_INTERNO = {
  type: 'about:blank',
  title: 'Erro interno',
  status: 500,
  code: 'uniplus.internal.unexpected',
};

async function responder(route: Route, status: number, corpo: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: status >= 400 ? 'application/problem+json' : 'application/json',
    headers: CORS_HEADERS,
    body: status === 204 ? undefined : JSON.stringify(corpo),
  });
}

type Recarga = 'com-a-fase' | 'sem-a-fase' | 'com-falha';

async function mockApi(
  page: Page,
  resposta: { status: number; corpo?: unknown },
  recarga: Recarga = 'com-a-fase',
  primeiraConsulta: 'ok' | 'falha' = 'ok',
) {
  let liberar: () => void = () => undefined;
  const retida = new Promise<void>((resolve) => (liberar = resolve));
  const envios: string[] = [];
  await page.route(/\/api\/organizacao\/unidades(\?.*)?$/, (route) => responder(route, 200, []));
  let consultas = 0;
  await page.route(/\/api\/configuracao\/fases-canonicas(\?.*)?$/, async (route) => {
    consultas += 1;
    if (primeiraConsulta === 'falha' && consultas === 1) {
      await responder(route, 500, ERRO_INTERNO);
      return;
    }
    if (consultas > 1) await new Promise((resolve) => setTimeout(resolve, ATRASO_DA_RECARGA_EM_MS));
    if (consultas > 1 && recarga === 'com-falha') {
      await responder(route, 500, {
        type: 'about:blank',
        title: 'Erro interno',
        status: 500,
        code: 'uniplus.internal.unexpected',
      });
      return;
    }
    await responder(route, 200, consultas > 1 && recarga === 'sem-a-fase' ? [] : [FASE]);
  });
  await page.route(/\/api\/configuracao\/admin\/fases-canonicas\/[^/?]+$/, async (route) => {
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

test.describe('Fase canônica — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('o catálogo institucional não oferece criação', async ({ page }) => {
    await mockApi(page, { status: 204 });
    await page.goto('/fases-canonicas');
    await expect(
      page.getByRole('button', { name: 'Editar fase canônica AVALIACAO' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /nova fase canônica|criar fase canônica/i }),
    ).toHaveCount(0);
  });

  test('edição pendente preserva foco e valores e a recusa foca o campo', async ({ page }) => {
    const { liberar, envios } = await mockApi(page, {
      status: 422,
      corpo: {
        type: 'about:blank',
        title: 'Dados inválidos',
        status: 422,
        code: 'uniplus.validacao',
        errors: [
          {
            field: 'Nome',
            code: 'uniplus.configuracao.fase.nome_invalido',
            message: 'Nome fora do padrão.',
          },
        ],
      },
    });
    await page.goto('/fases-canonicas');
    await page.getByRole('button', { name: 'Editar fase canônica AVALIACAO' }).click();
    const drawer = page.getByRole('dialog', { name: 'Formulário de fase canônica' });
    const nome = drawer.locator('input[formcontrolname="nome"]');
    await nome.fill('Avaliação revisada');
    await drawer.getByRole('button', { name: 'Salvar fase canônica' }).click();
    const salvar = drawer.getByRole('button', { name: 'Salvando...' });
    await expect(nome).toBeDisabled();
    await expect(nome).toHaveValue('Avaliação revisada');
    await expect(salvar).toBeFocused();
    await expect(salvar).toHaveAttribute('aria-disabled', 'true');
    await expect(salvar).toHaveAttribute('aria-busy', 'true');
    await expect(salvar).toHaveCSS('cursor', 'not-allowed');
    await expect(drawer.locator('[role="status"]').first()).toContainText('Salvando');
    await expect(drawer.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await salvar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(envios).toEqual(['PUT']);
    liberar();
    await expect(nome).toBeEnabled();
    await expect(nome).toBeFocused();
    await expect(nome).toHaveAttribute('aria-invalid', 'true');
    await expect(drawer.getByText('Nome fora do padrão.')).toBeVisible();
  });

  test('Enter no campo leva o foco ao botão de salvar e, na falha 500, o envio segue disponível', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, { status: 500, corpo: ERRO_INTERNO });
    await page.goto('/fases-canonicas');
    await page.getByRole('button', { name: 'Editar fase canônica AVALIACAO' }).click();
    const drawer = page.getByRole('dialog', { name: 'Formulário de fase canônica' });
    const nome = drawer.locator('input[formcontrolname="nome"]');
    await nome.focus();
    await page.keyboard.press('Enter');
    await expect(nome).toBeDisabled();
    await expect(drawer.getByRole('button', { name: 'Salvando...' })).toBeFocused();
    liberar();
    await expect(drawer.getByText('Erro interno')).toBeVisible();
    await expect(nome).toBeEnabled();
    await expect(drawer.getByRole('button', { name: 'Salvar fase canônica' })).toBeFocused();
    expect(envios).toEqual(['PUT']);
  });

  test('envio barrado localmente leva o foco ao primeiro campo inválido', async ({ page }) => {
    const { envios } = await mockApi(page, { status: 204 });
    await page.goto('/fases-canonicas');
    await page.getByRole('button', { name: 'Editar fase canônica AVALIACAO' }).click();
    const drawer = page.getByRole('dialog', { name: 'Formulário de fase canônica' });
    const nome = drawer.locator('input[formcontrolname="nome"]');
    await nome.fill('');
    await drawer.getByRole('button', { name: 'Salvar fase canônica' }).focus();
    await page.keyboard.press('Enter');
    await expect(nome).toBeFocused();
    await expect(nome).toHaveAttribute('aria-invalid', 'true');
    expect(envios).toEqual([]);
  });

  test('"Tentar novamente" fica focado e indisponível durante a carga e leva o foco ao título', async ({
    page,
  }) => {
    await mockApi(page, { status: 204 }, 'com-a-fase', 'falha');
    await page.goto('/fases-canonicas');
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(
      page.getByRole('button', { name: 'Editar fase canônica AVALIACAO' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Fases canônicas', level: 2 })).toBeFocused();
  });

  test('edição concluída devolve o foco ao acionador', async ({ page }) => {
    const { liberar } = await mockApi(page, { status: 204 });
    await page.goto('/fases-canonicas');
    const acionador = page.getByRole('button', { name: 'Editar fase canônica AVALIACAO' });
    await acionador.click();
    const drawer = page.getByRole('dialog', { name: 'Formulário de fase canônica' });
    await drawer.getByRole('button', { name: 'Salvar fase canônica' }).click();
    liberar();
    await expect(drawer).toBeHidden();
    await expect(acionador).toBeFocused();
  });

  test('remoção pendente mantém o diálogo e anuncia o andamento', async ({ page }) => {
    const { liberar, envios } = await mockApi(page, { status: 204 });
    await page.goto('/fases-canonicas');
    await page.getByRole('button', { name: 'Remover fase canônica AVALIACAO' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Remover fase canônica' });
    const remover = dialogo.getByRole('button', { name: 'Remover', exact: true });
    await remover.click();
    await expect(remover).toBeFocused();
    await expect(remover).toHaveAttribute('aria-disabled', 'true');
    await expect(remover).toHaveCSS('cursor', 'not-allowed');
    await expect(dialogo.getByRole('status')).toContainText('Removendo');
    await expect(dialogo.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeVisible();
    await remover.dispatchEvent('click');
    expect(envios).toEqual(['DELETE']);
    liberar();
    await expect(dialogo).toBeHidden();
  });

  test('remoção concluída, com a linha ausente da recarga, leva o foco ao título da lista', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, { status: 204 }, 'sem-a-fase');
    await page.goto('/fases-canonicas');
    await page.getByRole('button', { name: 'Remover fase canônica AVALIACAO' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Remover fase canônica' });
    await dialogo.getByRole('button', { name: 'Remover', exact: true }).click();
    liberar();
    await expect(dialogo).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Fases canônicas', level: 2 })).toBeFocused();
  });

  test('edição concluída, com falha na recarga, leva o foco ao título da lista', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, { status: 204 }, 'com-falha');
    await page.goto('/fases-canonicas');
    await page.getByRole('button', { name: 'Editar fase canônica AVALIACAO' }).click();
    const drawer = page.getByRole('dialog', { name: 'Formulário de fase canônica' });
    await drawer.getByRole('button', { name: 'Salvar fase canônica' }).click();
    liberar();
    await expect(drawer).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Fases canônicas', level: 2 })).toBeFocused();
  });

  test('remoção recusada mantém o diálogo aberto e o foco dentro dele', async ({ page }) => {
    const { liberar } = await mockApi(page, {
      status: 422,
      corpo: {
        type: 'about:blank',
        title: 'Fase em uso',
        status: 422,
        code: 'uniplus.configuracao.fase.em_uso',
      },
    });
    await page.goto('/fases-canonicas');
    await page.getByRole('button', { name: 'Remover fase canônica AVALIACAO' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Remover fase canônica' });
    await dialogo.getByRole('button', { name: 'Remover', exact: true }).click();
    liberar();
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
    await expect(dialogo).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Fases canônicas', level: 2 }),
    ).not.toBeFocused();
    await expect(dialogo.locator(':focus')).toHaveCount(1);
  });
});
