import { expect, test, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const VIGENTE = {
  id: '019ff7ee-3c00-7976-860c-eb2f61c9b2d1',
  versaoDataset: '2026.1',
  vigente: true,
  criadoEm: '2026-08-13T12:00:00Z',
};
const ANTERIOR = {
  id: '019ff7ee-3c00-7976-860c-eb2f61c9b2d2',
  versaoDataset: '2025.2',
  vigente: false,
  criadoEm: '2025-11-04T12:00:00Z',
};

/** Atraso da recarga da lista após a escrita: o botão da linha ainda está indisponível quando o diálogo fecha. */
const ATRASO_DA_RECARGA_EM_MS = 1500;

const CODIGOS = 'uniplus.configuracao.calendario_dias_uteis';
const problema = (status: number, code: string, title: string) => ({
  type: 'about:blank',
  title,
  status,
  code,
});
const NAO_REMOVE_VIGENTE = problema(
  409,
  `${CODIGOS}.nao_remove_vigente`,
  'O dataset vigente não pode ser removido',
);
const NAO_ENCONTRADO = problema(404, `${CODIGOS}.nao_encontrado`, 'Calendário não encontrado');
const JA_VIGENTE = problema(409, `${CODIGOS}.ja_vigente`, 'Este dataset já é o vigente');
const PROCESSANDO = problema(
  409,
  'uniplus.idempotency.processing_conflict',
  'Escrita em processamento',
);
const ERRO_INTERNO = problema(500, 'uniplus.erro_interno', 'Erro interno');

async function responder(route: Route, status: number, corpo?: unknown): Promise<void> {
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

type Resposta = { status: number; corpo?: unknown };
type Recarga = 'sem-o-anterior' | 'com-o-anterior' | 'com-falha';

/** Cada escrita consome a próxima resposta e fica retida até `liberar`. */
async function mockApi(
  page: Page,
  respostas: readonly Resposta[],
  recarga: Recarga = 'sem-o-anterior',
  primeiraConsulta: 'ok' | 'falha' = 'ok',
) {
  let liberar: () => void = () => undefined;
  let retida = new Promise<void>((resolve) => (liberar = resolve));
  const envios: { metodo: string; chave: string | undefined }[] = [];
  let consultas = 0;
  await page.route(/\/api\/configuracao\/calendarios-dias-uteis(\?.*)?$/, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await responder(route, 204);
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
    const lista = consultas > 1 && recarga === 'sem-o-anterior' ? [VIGENTE] : [VIGENTE, ANTERIOR];
    await responder(route, 200, lista);
  });
  await page.route(/\/api\/configuracao\/admin\/calendarios-dias-uteis\/.+$/, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await responder(route, 204);
      return;
    }
    const resposta = respostas[envios.length];
    envios.push({
      metodo: route.request().method(),
      chave: route.request().headers()['idempotency-key'],
    });
    await retida;
    await responder(route, resposta.status, resposta.corpo);
  });
  return {
    liberar: () => {
      liberar();
      retida = new Promise<void>((resolve) => (liberar = resolve));
    },
    envios,
  };
}

const tituloDaLista = (page: Page) => page.getByRole('heading', { name: 'Calendários', level: 2 });
const removerDoAnterior = (page: Page) =>
  page.getByRole('button', { name: 'Remover calendário 2025.2' });
const marcarDoAnterior = (page: Page) =>
  page.getByRole('button', { name: 'Marcar vigente 2025.2' });

async function abrirRemocao(page: Page) {
  await page.goto('/calendario-dias-uteis');
  await removerDoAnterior(page).click();
  const dialogo = page.getByRole('dialog', { name: 'Remover calendário?' });
  return { dialogo, confirmar: dialogo.getByRole('button', { name: 'Confirmar remoção' }) };
}

async function abrirVigencia(page: Page) {
  await page.goto('/calendario-dias-uteis');
  await marcarDoAnterior(page).click();
  const dialogo = page.getByRole('dialog', { name: 'Marcar calendário como vigente?' });
  return {
    dialogo,
    confirmar: dialogo.getByRole('button', { name: 'Marcar vigente', exact: true }),
  };
}

const regiaoDeStatus = (escopo: ReturnType<Page['locator']>, texto: string) =>
  escopo.locator('[role="status"]').filter({ hasText: texto });

test.describe('Calendário de dias úteis — lista, escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('remoção pendente mantém o diálogo, recusa Esc, X e reenvio e anuncia o andamento', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [{ status: 204 }]);
    const { dialogo, confirmar } = await abrirRemocao(page);
    await confirmar.click();
    await expect(confirmar).toBeFocused();
    await expect(confirmar).toHaveAttribute('aria-disabled', 'true');
    await expect(confirmar).toHaveAttribute('aria-busy', 'true');
    await expect(confirmar).toHaveCSS('cursor', 'not-allowed');
    await expect(regiaoDeStatus(dialogo, 'Removendo o calendário 2025.2.')).toBeVisible();
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await expect(dialogo.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeVisible();
    await confirmar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(envios.map((envio) => envio.metodo)).toEqual(['DELETE']);
    liberar();
    await expect(dialogo).toBeHidden();
  });

  test('remoção concluída, com o calendário ausente da recarga atrasada, leva o foco ao título da lista', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], 'sem-o-anterior');
    const { dialogo, confirmar } = await abrirRemocao(page);
    await confirmar.click();
    liberar();
    await expect(dialogo).toBeHidden();
    await expect(tituloDaLista(page)).toBeFocused();
    await expect(removerDoAnterior(page)).toHaveCount(0);
  });

  test('remoção concluída, com o calendário ainda na recarga atrasada, devolve o foco ao botão da linha', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], 'com-o-anterior');
    const { dialogo, confirmar } = await abrirRemocao(page);
    await confirmar.click();
    liberar();
    await expect(dialogo).toBeHidden();
    await expect(removerDoAnterior(page)).toBeFocused();
  });

  test('remoção concluída, com falha na recarga, leva o foco ao título da lista', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], 'com-falha');
    const { dialogo, confirmar } = await abrirRemocao(page);
    await confirmar.click();
    liberar();
    await expect(dialogo).toBeHidden();
    await expect(tituloDaLista(page)).toBeFocused();
  });

  test('remoção recusada com 409 mantém o diálogo com a recusa, o foco dentro dele e a lista relida', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 409, corpo: NAO_REMOVE_VIGENTE }]);
    const { dialogo, confirmar } = await abrirRemocao(page);
    await confirmar.click();
    liberar();
    await expect(
      dialogo.getByText('O dataset vigente não pode ser removido').first(),
    ).toBeVisible();
    await expect(
      regiaoDeStatus(dialogo, 'Não foi possível remover o calendário 2025.2.'),
    ).toBeVisible();
    await expect(confirmar).toBeFocused();
    await expect(confirmar).not.toHaveAttribute('aria-disabled', 'true');
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
    await expect(dialogo).toBeVisible();
    await expect(tituloDaLista(page)).not.toBeFocused();
  });

  test('remoção recusada com 404, com a linha ausente da lista relida, leva o foco ao título ao cancelar', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 404, corpo: NAO_ENCONTRADO }]);
    const { dialogo, confirmar } = await abrirRemocao(page);
    await confirmar.click();
    liberar();
    await expect(dialogo.getByText('Calendário não encontrado').first()).toBeVisible();
    await expect(removerDoAnterior(page)).toHaveCount(0);
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();
    await expect(tituloDaLista(page)).toBeFocused();
  });

  test('marcar vigente recusado com 409 ja_vigente leva o foco ao título ao cancelar, mesmo com a releitura em curso', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 409, corpo: JA_VIGENTE }]);
    const { dialogo, confirmar } = await abrirVigencia(page);
    await confirmar.click();
    liberar();
    await expect(dialogo.getByText('Este dataset já é o vigente').first()).toBeVisible();
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();
    await expect(tituloDaLista(page)).toBeFocused();
  });

  test('remoção com falha 500 mantém o diálogo com a mensagem e deixa tentar de novo', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [
      { status: 500, corpo: ERRO_INTERNO },
      { status: 204 },
    ]);
    const { dialogo, confirmar } = await abrirRemocao(page);
    await confirmar.click();
    liberar();
    await expect(dialogo.getByText('Erro interno').first()).toBeVisible();
    await expect(confirmar).toBeFocused();
    await confirmar.click();
    liberar();
    await expect(dialogo).toBeHidden();
    expect(envios.map((envio) => envio.metodo)).toEqual(['DELETE', 'DELETE']);
  });

  test('marcar vigente pendente mantém o diálogo, recusa Esc e reenvio e, concluído, leva o foco ao título', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [{ status: 204 }]);
    const { dialogo, confirmar } = await abrirVigencia(page);
    await confirmar.click();
    await expect(confirmar).toBeFocused();
    await expect(confirmar).toHaveAttribute('aria-disabled', 'true');
    await expect(
      regiaoDeStatus(dialogo, 'Marcando como vigente o calendário 2025.2.'),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeVisible();
    await confirmar.dispatchEvent('click');
    expect(envios.map((envio) => envio.metodo)).toEqual(['POST']);
    liberar();
    await expect(dialogo).toBeHidden();
    await expect(tituloDaLista(page)).toBeFocused();
  });

  test('marcar vigente recusado com 409 fica no diálogo e renova a chave; o conflito de processamento a mantém', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [
      { status: 409, corpo: JA_VIGENTE },
      { status: 409, corpo: PROCESSANDO },
      { status: 409, corpo: PROCESSANDO },
    ]);
    const { dialogo, confirmar } = await abrirVigencia(page);
    await confirmar.click();
    liberar();
    await expect(dialogo.getByText('Este dataset já é o vigente').first()).toBeVisible();
    await expect(confirmar).toBeFocused();
    await expect(confirmar).not.toHaveAttribute('aria-disabled', 'true');

    await confirmar.click();
    liberar();
    await expect(dialogo.getByText('Escrita em processamento').first()).toBeVisible();
    await confirmar.click();
    liberar();
    await expect(confirmar).not.toHaveAttribute('aria-disabled', 'true');
    await expect(dialogo).toBeVisible();

    const [primeira, segunda, terceira] = envios.map((envio) => envio.chave);
    expect(primeira).toBeTruthy();
    expect(segunda).not.toBe(primeira);
    expect(terceira).toBe(segunda);
  });

  test('"Tentar novamente" fica focado e indisponível durante a carga e leva o foco ao título', async ({
    page,
  }) => {
    await mockApi(page, [], 'com-o-anterior', 'falha');
    await page.goto('/calendario-dias-uteis');
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(removerDoAnterior(page)).toBeVisible();
    await expect(tituloDaLista(page)).toBeFocused();
  });
});
