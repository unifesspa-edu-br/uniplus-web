import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const ITEM = {
  tipo: 'TIPO_DOCUMENTO',
  id: '01960000-0000-7000-0000-0000000000d2',
  codigo: 'LAUDO_MEDICO_COMPLEMENTAR',
  nome: 'Laudo médico complementar',
  classificacaoProtecao: 'INTERNO',
  finalidadeTratamento: 'Conferir o laudo do candidato com deficiência.',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
  aprovacao: {
    situacao: 'SOLICITADA',
    solicitadaEm: '2026-11-01T12:00:00Z',
    decididaEm: null,
    classificacaoRecomendada: null,
    justificativa: null,
    aceitaEm: null,
  },
};

const DETALHE = {
  ...ITEM,
  descricao: 'Laudo que complementa o pedido de atendimento especializado.',
  fato: null,
  tipoDocumento: { categoria: 'SAUDE', formatosAceitos: 'pdf,jpg', tamanhoMaximoMb: 10 },
  atos: [],
};

const DECISAO = {
  cadastro: 'TIPO_DOCUMENTO',
  itemId: ITEM.id,
  itemCodigo: ITEM.codigo,
  itemNome: ITEM.nome,
  ato: 'REPROVACAO',
  instante: '2026-10-31T13:00:00Z',
  atorNome: 'Caroline Ribeiro',
  classificacaoProtecao: 'INTERNO',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
  finalidadeTratamento: 'Conferir o laudo.',
  classificacaoRecomendada: null,
  justificativa: 'Falta a base legal.',
};

/** Atraso da recarga da fila após a decisão: o drawer já fechou quando ela termina. */
const ATRASO_DA_RECARGA_EM_MS = 1500;

const problema = (status: number, code: string, title: string) => ({
  type: 'about:blank',
  title,
  status,
  code,
});
const ERRO_INTERNO = problema(500, 'uniplus.erro_interno', 'Erro interno');
const CONCORRENCIA = problema(
  409,
  'uniplus.configuracao.protecao_do_catalogo.protecao_mudou',
  'A proteção do item mudou desde a leitura',
);
const EM_PROCESSAMENTO = problema(
  409,
  'uniplus.idempotency.processing_conflict',
  'A decisão ainda está em processamento',
);
const SEM_QUEM_APROVE = problema(
  422,
  'uniplus.configuracao.protecao_do_catalogo.sem_quem_aprove',
  'Ninguém tem a permissão de aprovar',
);

type Recarga = 'sem-o-item' | 'com-o-item' | 'com-falha';
type Resposta = { status: number; corpo?: unknown };
type Leitura = 'ok' | 'falha-na-primeira';

interface Opcoes {
  readonly decisoes: readonly Resposta[];
  readonly recarga?: Recarga;
  readonly fila?: Leitura;
  readonly detalhe?: Leitura;
}

function retida(): { espera: Promise<void>; liberar: () => void } {
  let liberar: () => void = () => undefined;
  const espera = new Promise<void>((resolve) => (liberar = resolve));
  return { espera, liberar };
}

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

/**
 * Cada POST consome a próxima resposta e fica retido até `liberar`; as leituras da fila que o
 * seguem demoram `ATRASO_DA_RECARGA_EM_MS` e respondem conforme `recarga`.
 */
async function mockApi(page: Page, opcoes: Opcoes) {
  const { decisoes, recarga = 'sem-o-item', fila = 'ok', detalhe = 'ok' } = opcoes;
  const portoes = decisoes.map(() => retida());
  const chaves: (string | undefined)[] = [];
  let leiturasDaFila = 0;
  let leiturasDoDetalhe = 0;

  await page.route(/\/api\/configuracao\/categorias-documento(\?.*)?$/, (r) =>
    responder(r, 200, []),
  );
  await page.route(
    /\/api\/configuracao\/admin\/protecao-do-catalogo\/tipos-documento\/[^/?]+$/,
    async (r) => {
      leiturasDoDetalhe += 1;
      if (detalhe === 'falha-na-primeira' && leiturasDoDetalhe === 1) {
        await responder(r, 500, ERRO_INTERNO);
        return;
      }
      if (leiturasDoDetalhe > 1)
        await new Promise((resolve) => setTimeout(resolve, ATRASO_DA_RECARGA_EM_MS));
      await responder(r, 200, DETALHE);
    },
  );
  await page.route(/\/api\/configuracao\/admin\/protecao-do-catalogo(\?.*)?$/, async (route) => {
    const metodo = route.request().method();
    if (metodo === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    if (metodo === 'POST') {
      const indice = chaves.length;
      chaves.push(route.request().headers()['idempotency-key']);
      await portoes[indice].espera;
      await responder(route, decisoes[indice].status, decisoes[indice].corpo);
      return;
    }
    leiturasDaFila += 1;
    if (fila === 'falha-na-primeira' && leiturasDaFila === 1) {
      await responder(route, 500, ERRO_INTERNO);
      return;
    }
    if (leiturasDaFila > 1) await new Promise((r) => setTimeout(r, ATRASO_DA_RECARGA_EM_MS));
    if (leiturasDaFila > 1 && recarga === 'com-falha') {
      await responder(route, 500, ERRO_INTERNO);
      return;
    }
    await responder(route, 200, leiturasDaFila > 1 && recarga === 'sem-o-item' ? [] : [ITEM]);
  });
  return {
    chaves: () => chaves,
    liberar: (indice = 0) => portoes[indice].liberar(),
  };
}

const titulo = (page: Page) =>
  page.getByRole('heading', { name: 'Itens aguardando a sua decisão', level: 2 });
const linha = (page: Page) => page.getByRole('button', { name: `Ver o detalhe de ${ITEM.nome}` });
const painel = (page: Page) =>
  page.getByRole('dialog', { name: 'Detalhe do item aguardando a decisão' });
const dialogoDeReprovacao = (page: Page) =>
  page.getByRole('dialog', { name: 'Reprovar a proteção de dados do item' });

async function abrirItem(page: Page): Promise<{ drawer: Locator; aprovar: Locator }> {
  await page.goto('/protecao-do-catalogo');
  await linha(page).click();
  const drawer = painel(page);
  const aprovar = drawer.getByRole('button', { name: /Aprovar/ });
  await expect(aprovar).toBeVisible();
  return { drawer, aprovar };
}

async function abrirReprovacao(page: Page, justificativa: string | null) {
  const { drawer } = await abrirItem(page);
  await drawer.getByRole('button', { name: 'Reprovar' }).click();
  const dialogo = dialogoDeReprovacao(page);
  const campo = dialogo.getByRole('textbox', { name: /Justificativa/ });
  if (justificativa !== null) await campo.fill(justificativa);
  const confirmar = dialogo.locator('.uni-dialog__footer .btn--danger');
  return { drawer, dialogo, campo, confirmar };
}

test.describe('Proteção de dados do catálogo — decisões e foco', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('aprovação pendente mantém o botão focado e ocupado, recusa Esc e X e não reenvia', async ({
    page,
  }) => {
    const mock = await mockApi(page, { decisoes: [{ status: 204 }] });
    const { drawer, aprovar } = await abrirItem(page);

    await aprovar.click();
    await expect(aprovar).toBeFocused();
    await expect(aprovar).toHaveAttribute('aria-disabled', 'true');
    await expect(aprovar).toHaveAttribute('aria-busy', 'true');
    await expect(aprovar).toHaveCSS('cursor', 'not-allowed');
    await expect(drawer.locator('.form-drawer__form > [role="status"]')).toContainText(
      'Registrando a decisão',
    );
    await expect(drawer.getByRole('button', { name: 'Fechar' }).first()).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeVisible();
    await aprovar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(mock.chaves()).toHaveLength(1);

    mock.liberar();
    await expect(drawer).toBeHidden();
  });

  test('aprovação concluída, com o item ausente da recarga atrasada, leva o foco ao título', async ({
    page,
  }) => {
    const mock = await mockApi(page, { decisoes: [{ status: 204 }], recarga: 'sem-o-item' });
    const { drawer, aprovar } = await abrirItem(page);

    await aprovar.click();
    mock.liberar();
    await expect(drawer).toBeHidden();
    await expect(titulo(page)).toBeFocused();
  });

  test('aprovação concluída, com falha na recarga, leva o foco ao título e oferece nova tentativa', async ({
    page,
  }) => {
    const mock = await mockApi(page, { decisoes: [{ status: 204 }], recarga: 'com-falha' });
    const { drawer, aprovar } = await abrirItem(page);

    await aprovar.click();
    mock.liberar();
    await expect(drawer).toBeHidden();
    await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
    await expect(titulo(page)).toBeFocused();
  });

  test('aprovação concluída não tira o foco de quem o levou a outro ponto durante a recarga', async ({
    page,
  }) => {
    const mock = await mockApi(page, { decisoes: [{ status: 204 }] });
    const { drawer, aprovar } = await abrirItem(page);

    await aprovar.click();
    mock.liberar();
    await expect(drawer).toBeHidden();
    await page.evaluate(() => {
      const outro = document.createElement('button');
      outro.id = 'foco-externo';
      document.body.append(outro);
      outro.focus();
    });
    await expect(page.getByText('Nenhum item aguardando a sua decisão')).toBeVisible();
    await expect(page.locator('#foco-externo')).toBeFocused();
  });

  test('erro do servidor mantém o foco no botão, que aceita o clique e repete com a mesma chave', async ({
    page,
  }) => {
    const mock = await mockApi(page, {
      decisoes: [{ status: 500, corpo: ERRO_INTERNO }, { status: 204 }],
    });
    const { drawer, aprovar } = await abrirItem(page);

    await aprovar.click();
    mock.liberar(0);
    await expect(drawer.locator('ui-alert').getByText('Erro interno')).toBeVisible();
    await expect(aprovar).not.toHaveAttribute('aria-disabled', 'true');
    await expect(aprovar).toBeFocused();

    await aprovar.click();
    mock.liberar(1);
    await expect(drawer).toBeHidden();
    expect(mock.chaves()).toHaveLength(2);
    expect(mock.chaves()[1]).toBe(mock.chaves()[0]);
  });

  test('recusa de regra (422) mantém o drawer aberto e o foco no botão', async ({ page }) => {
    const mock = await mockApi(page, { decisoes: [{ status: 422, corpo: SEM_QUEM_APROVE }] });
    const { drawer, aprovar } = await abrirItem(page);

    await aprovar.click();
    mock.liberar();
    await expect(drawer.getByText('Ninguém tem a permissão de aprovar')).toBeVisible();
    await expect(drawer).toBeVisible();
    await expect(aprovar).toBeFocused();
    await expect(aprovar).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('proteção alterada (409) fecha o drawer, relê a fila e leva o foco ao título', async ({
    page,
  }) => {
    const mock = await mockApi(page, {
      decisoes: [{ status: 409, corpo: CONCORRENCIA }],
      recarga: 'sem-o-item',
    });
    const { drawer, aprovar } = await abrirItem(page);

    await aprovar.click();
    mock.liberar();
    await expect(drawer).toBeHidden();
    await expect(page.getByText(/A proteção do item mudou desde a leitura/).first()).toBeVisible();
    await expect(titulo(page)).toBeFocused();
  });

  test('reprovação pendente deixa o diálogo somente leitura, com o botão focado e Esc e X recusados', async ({
    page,
  }) => {
    const mock = await mockApi(page, { decisoes: [{ status: 204 }] });
    const { dialogo, campo, confirmar } = await abrirReprovacao(page, 'Falta a base legal.');

    await confirmar.click();
    await expect(confirmar).toBeFocused();
    await expect(confirmar).toHaveAttribute('aria-disabled', 'true');
    await expect(confirmar).toHaveAttribute('aria-busy', 'true');
    await expect(confirmar).toHaveCSS('cursor', 'not-allowed');
    await expect(campo).toBeDisabled();
    await expect(campo).toHaveValue('Falta a base legal.');
    await expect(dialogo.locator('.sr-only[role="status"]')).toContainText('Registrando decisão');
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await expect(dialogo.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeVisible();
    await confirmar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(mock.chaves()).toHaveLength(1);

    mock.liberar();
    await expect(dialogo).toBeHidden();
    await expect(painel(page)).toBeHidden();
    await expect(titulo(page)).toBeFocused();
  });

  test('envio barrado por justificativa em branco leva o foco ao campo e não envia', async ({
    page,
  }) => {
    const mock = await mockApi(page, { decisoes: [] });
    const { campo, confirmar } = await abrirReprovacao(page, null);

    await confirmar.focus();
    await page.keyboard.press('Enter');

    await expect(campo).toBeFocused();
    await expect(campo).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Informe a justificativa da reprovação.')).toBeVisible();
    expect(mock.chaves()).toHaveLength(0);
  });

  test('reprovação recusada pelo servidor mantém o diálogo, o foco no botão e a recusa visível', async ({
    page,
  }) => {
    const mock = await mockApi(page, { decisoes: [{ status: 500, corpo: ERRO_INTERNO }] });
    const { dialogo, confirmar } = await abrirReprovacao(page, 'Falta a base legal.');

    await confirmar.click();
    mock.liberar();
    await expect(dialogo.getByText('Erro interno')).toBeVisible();
    await expect(confirmar).not.toHaveAttribute('aria-disabled', 'true');
    await expect(confirmar).toBeFocused();
    await expect(dialogo).toBeVisible();
  });

  test('decisão ainda em processamento (409) mantém o diálogo, o foco e a mesma chave', async ({
    page,
  }) => {
    const mock = await mockApi(page, {
      decisoes: [{ status: 409, corpo: EM_PROCESSAMENTO }, { status: 204 }],
    });
    const { dialogo, confirmar } = await abrirReprovacao(page, 'Falta a base legal.');

    await confirmar.click();
    mock.liberar(0);
    await expect(dialogo.getByText('A decisão ainda está em processamento')).toBeVisible();
    await expect(dialogo).toBeVisible();
    await expect(confirmar).toBeFocused();

    await confirmar.click();
    mock.liberar(1);
    await expect(dialogo).toBeHidden();
    expect(mock.chaves()[1]).toBe(mock.chaves()[0]);
  });

  test('diálogo que se fecha sozinho pela proteção alterada leva o foco ao título', async ({
    page,
  }) => {
    const mock = await mockApi(page, {
      decisoes: [{ status: 409, corpo: CONCORRENCIA }],
      recarga: 'sem-o-item',
    });
    const { dialogo, confirmar } = await abrirReprovacao(page, 'Falta a base legal.');

    await confirmar.click();
    mock.liberar();
    await expect(dialogo).toBeHidden();
    await expect(painel(page)).toBeHidden();
    await expect(titulo(page)).toBeFocused();
  });

  test('"Tentar novamente" da fila fica focado e indisponível durante a carga e leva o foco ao título', async ({
    page,
  }) => {
    await mockApi(page, { decisoes: [], fila: 'falha-na-primeira', recarga: 'com-o-item' });
    await page.goto('/protecao-do-catalogo');
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });

    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(linha(page)).toBeVisible();
    await expect(titulo(page)).toBeFocused();
  });

  test('"Tentar novamente" do detalhe leva o foco à região dos dados do item', async ({ page }) => {
    await mockApi(page, { decisoes: [], detalhe: 'falha-na-primeira' });
    await page.goto('/protecao-do-catalogo');
    await linha(page).click();
    const tentar = painel(page).getByRole('button', { name: 'Tentar novamente' });

    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(painel(page).getByText('Proposta de proteção')).toBeVisible();
    await expect(painel(page).getByRole('region', { name: 'Dados do item' })).toBeFocused();
  });
});

test.describe('Proteção de dados do catálogo — aba Decisões', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  async function mockDecisoes(page: Page, historico: Leitura) {
    let leituras = 0;
    let leiturasDoHistorico = 0;
    await page.route(/\/api\/configuracao\/admin\/protecao-do-catalogo(\?.*)?$/, (r) =>
      responder(r, 200, []),
    );
    await page.route(
      /\/api\/configuracao\/admin\/protecao-do-catalogo\/tipos-documento\/[^/?]+$/,
      async (r) => {
        leiturasDoHistorico += 1;
        if (historico === 'falha-na-primeira' && leiturasDoHistorico === 1) {
          await responder(r, 500, ERRO_INTERNO);
          return;
        }
        if (leiturasDoHistorico > 1) {
          await new Promise((resolve) => setTimeout(resolve, ATRASO_DA_RECARGA_EM_MS));
        }
        await responder(r, 200, DETALHE);
      },
    );
    await page.route(
      /\/api\/configuracao\/admin\/protecao-do-catalogo\/decisoes(\?.*)?$/,
      async (r) => {
        leituras += 1;
        if (leituras === 1) {
          await responder(r, 500, ERRO_INTERNO);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, ATRASO_DA_RECARGA_EM_MS));
        await responder(r, 200, [DECISAO]);
      },
    );
  }

  test('"Tentar novamente" fica focado e indisponível durante a carga e leva o foco ao título', async ({
    page,
  }) => {
    await mockDecisoes(page, 'ok');
    await page.goto('/protecao-do-catalogo?aba=decisoes');
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });

    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(
      page.getByRole('button', { name: `Ver a decisão sobre ${ITEM.nome}` }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Decisões registradas', level: 2 }),
    ).toBeFocused();
  });

  test('"Tentar novamente" do histórico leva o foco à região dos dados da decisão', async ({
    page,
  }) => {
    await mockDecisoes(page, 'falha-na-primeira');
    await page.goto('/protecao-do-catalogo?aba=decisoes');
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await page.getByRole('button', { name: `Ver a decisão sobre ${ITEM.nome}` }).click();
    const drawer = page.getByRole('dialog', { name: 'Detalhe da decisão' });
    const tentar = drawer.getByRole('button', { name: 'Tentar novamente' });

    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(drawer.getByText('Histórico do item')).toBeVisible();
    await expect(drawer.getByRole('region', { name: 'Dados da decisão' })).toBeFocused();
  });
});
