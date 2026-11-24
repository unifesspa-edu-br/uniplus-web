import { expect, test, type Page } from '@playwright/test';
import { mockPermissoesEfetivas } from '@uniplus/shared-e2e';
import {
  CATALOGO_DESATUALIZADO,
  MENSAGEM_DO_CATALOGO_DESATUALIZADO,
  ERRO_INTERNO,
  mockRota,
  mockUnidades,
  problema,
} from '../support/api-de-perfis-filas';
import {
  PERMISSOES_DA_BETINA_SO_APROVA,
  PERMISSOES_DAS_DUAS_ETAPAS,
  PERMISSOES_DO_DIOGO_SO_APROVA,
} from '../support/permissoes';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

import {
  ID,
  FILA,
  DETALHE,
  DOCUMENTO,
  URL_DO_DOCUMENTO,
  ITEM_DA_FILA,
  concessao,
  RECLASSIFICACAO,
  DECISAO_OK,
  preparar,
} from '../support/reclassificacao-cenario';

const marcar = (page: Page, nome: string) =>
  page.locator('label.checkbox', { hasText: `Decidir a concessão de ${nome}` }).click();
const liberar = (page: Page) => page.getByRole('button', { name: 'Liberar as concessões' });
const tituloDasVersoes = (page: Page) =>
  page.getByRole('heading', { name: 'Versões em uso', level: 2 });

test.describe('Acessos — fila da reclassificação', () => {
  test('Diogo vê a reclassificação da fila dele e abre o detalhe pelo link', async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
    await mockPermissoesEfetivas(page, PERMISSOES_DO_DIOGO_SO_APROVA);
    await mockUnidades(page);
    const fila = await mockRota(page, FILA, () => ({ status: 200, corpo: [ITEM_DA_FILA] }));
    await mockRota(page, DETALHE, () => ({ status: 200, corpo: RECLASSIFICACAO }));
    await page.goto('/acessos/reclassificacoes/gestao-de-acessos');

    await expect(
      page.getByRole('heading', { name: 'Reclassificações na gestão de acessos', level: 1 }),
    ).toBeVisible();
    await expect(page.getByText('Classificação: de Interna para Dado pessoal')).toBeVisible();
    await expect(page.getByText('Escopo: de Instituição para Unidade')).toBeVisible();
    await expect(page.getByText('3 concessões')).toBeVisible();
    expect(fila[0]).toMatchObject({
      caminho: '/api/autorizacao/reclassificacoes',
      consulta: '?etapa=GESTAO_DE_ACESSOS',
    });

    await page.getByRole('link', { name: 'Operador de inscrições' }).click();

    await expect(page).toHaveURL(new RegExp(`/acessos/reclassificacoes/${ID}$`));
    await expect(
      page.getByRole('heading', { name: 'Operador de inscrições', level: 1 }),
    ).toBeVisible();
  });

  test('fila vazia diz que nenhuma reclassificação aguarda a decisão', async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
    await mockPermissoesEfetivas(page, PERMISSOES_DA_BETINA_SO_APROVA);
    const fila = await mockRota(page, FILA, () => ({ status: 200, corpo: [] }));
    await page.goto('/acessos/reclassificacoes/protecao-de-dados');

    await expect(page.getByText('Nenhuma reclassificação aguarda a sua decisão.')).toBeVisible();
    expect(fila[0]?.consulta).toBe('?etapa=PROTECAO_DE_DADOS');
  });

  test('falha na leitura oferece "Tentar novamente"', async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
    await mockPermissoesEfetivas(page, PERMISSOES_DO_DIOGO_SO_APROVA);
    const fila = await mockRota(page, FILA, (_c, n) =>
      n === 1 ? { status: 500, corpo: ERRO_INTERNO } : { status: 200, corpo: [ITEM_DA_FILA] },
    );
    await page.goto('/acessos/reclassificacoes/gestao-de-acessos');

    await expect(page.getByText('Não foi possível carregar a fila')).toBeVisible();
    await page.getByRole('button', { name: 'Tentar novamente' }).click();

    await expect(page.getByRole('link', { name: 'Operador de inscrições' })).toBeVisible();
    expect(fila).toHaveLength(2);
  });

  test('o catálogo desatualizado na fila mostra a mensagem inteira', async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
    await mockPermissoesEfetivas(page, PERMISSOES_DO_DIOGO_SO_APROVA);
    await mockRota(page, FILA, () => ({ status: 503, corpo: CATALOGO_DESATUALIZADO }));
    await page.goto('/acessos/reclassificacoes/gestao-de-acessos');

    await expect(page.getByText(MENSAGEM_DO_CATALOGO_DESATUALIZADO).first()).toBeVisible();
    await expect(page.getByText('Catalog out of date')).toHaveCount(0);
  });

  test('o menu oferece só a fila da etapa de quem só aprova por ela', async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
    await mockPermissoesEfetivas(page, PERMISSOES_DO_DIOGO_SO_APROVA);
    await mockRota(page, FILA, () => ({ status: 200, corpo: [] }));
    await page.goto('/acessos/reclassificacoes/gestao-de-acessos');
    const menu = page.getByRole('navigation', { name: 'Navegação principal' });

    await expect(
      menu.getByRole('link', { name: 'Reclassificações na gestão de acessos' }),
    ).toBeVisible();
    await expect(
      menu.getByRole('link', { name: 'Reclassificações na proteção de dados' }),
    ).toHaveCount(0);
  });
});

test.describe('Acessos — detalhe e decisão da reclassificação', () => {
  test('mostra o que mudou, as versões em uso e as concessões suspensas', async ({ page }) => {
    await preparar(page, PERMISSOES_DO_DIOGO_SO_APROVA);
    await page.goto(`/acessos/reclassificacoes/${ID}`);

    await expect(page.getByText('Permissão selecao:processos:aprovar')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Versão 2', level: 3 })).toBeVisible();
    const tabela = page.getByRole('table');
    await expect(
      tabela.locator('td[data-label="Pessoa"]', { hasText: 'Betina Teste' }),
    ).toBeVisible();
    await expect(tabela.getByText('CEPS').first()).toBeVisible();
    await expect(tabela.getByText('Sua concessão')).toBeVisible();
    await expect(page.locator('label.checkbox', { hasText: 'Diogo Teste' })).toHaveCount(0);
  });

  test('decisão individual envia só a concessão marcada e anuncia o resultado', async ({
    page,
  }) => {
    const { envios } = await preparar(page, PERMISSOES_DO_DIOGO_SO_APROVA);
    await page.goto(`/acessos/reclassificacoes/${ID}`);
    await marcar(page, 'Betina Teste');
    await liberar(page).click();

    await expect(
      page.getByText('Decisão registrada. Concessões decididas: 1. Liberadas: 1.'),
    ).toBeVisible();
    expect(envios).toHaveLength(1);
    expect(envios[0]).toMatchObject({
      metodo: 'POST',
      caminho: `/api/autorizacao/reclassificacoes/${ID}/decisoes`,
      corpo: {
        etapa: 'GESTAO_DE_ACESSOS',
        resultado: 'LIBERADA',
        concessoes: ['c1'],
        todas: false,
        motivo: null,
      },
    });
    expect(envios[0]?.chave).toBeTruthy();
  });

  test('decisão em lote envia "todas" e lista as concessões puladas com escopo e versão', async ({
    page,
  }) => {
    const { envios } = await preparar(page, PERMISSOES_DO_DIOGO_SO_APROVA, {
      decisao: [
        {
          status: 200,
          corpo: {
            loteId: 'lote-2',
            decididas: ['c1'],
            liberadas: ['c1'],
            paraOutraPessoa: ['c2'],
            puladasPorEscopo: ['c3'],
          },
        },
      ],
    });
    await page.goto(`/acessos/reclassificacoes/${ID}`);
    await page.locator('label.radio', { hasText: 'Todas as pendentes da etapa' }).click();
    await liberar(page).click();

    await expect(page.getByText('Ficaram para outra pessoa decidir')).toBeVisible();
    await expect(page.getByText('Diogo Teste — CEPS, versão 2')).toBeVisible();
    await expect(page.getByText('Puladas porque o escopo não comporta a liberação')).toBeVisible();
    await expect(page.getByText('Paulo Teste — Instituição, versão 2')).toBeVisible();
    expect(envios[0]).toMatchObject({
      metodo: 'POST',
      caminho: `/api/autorizacao/reclassificacoes/${ID}/decisoes`,
      corpo: {
        etapa: 'GESTAO_DE_ACESSOS',
        resultado: 'LIBERADA',
        concessoes: null,
        todas: true,
        motivo: null,
      },
    });
  });

  test('manter suspensas pede o motivo e o envia no corpo', async ({ page }) => {
    const { envios } = await preparar(page, PERMISSOES_DO_DIOGO_SO_APROVA, {
      decisao: [{ status: 200, corpo: { ...DECISAO_OK, liberadas: [] } }],
    });
    await page.goto(`/acessos/reclassificacoes/${ID}`);
    await marcar(page, 'Betina Teste');
    await page.getByRole('button', { name: 'Manter suspensas' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Manter as concessões suspensas' });
    await dialogo.locator('textarea').fill('A unidade ainda não adequou o escopo.');
    await dialogo.getByRole('button', { name: 'Manter suspensas' }).click();

    await expect(
      page.getByText('Decisão registrada. Concessões decididas: 1. Liberadas: 0.'),
    ).toBeVisible();
    expect(envios[0]).toMatchObject({
      metodo: 'POST',
      caminho: `/api/autorizacao/reclassificacoes/${ID}/decisoes`,
      corpo: {
        etapa: 'GESTAO_DE_ACESSOS',
        resultado: 'MANTIDA',
        concessoes: ['c1'],
        todas: false,
        motivo: 'A unidade ainda não adequou o escopo.',
      },
    });
  });

  test('com as duas permissões, a etapa escolhida vai no corpo', async ({ page }) => {
    const { envios } = await preparar(page, PERMISSOES_DAS_DUAS_ETAPAS, {
      detalhe: {
        status: 200,
        corpo: {
          ...RECLASSIFICACAO,
          concessoes: [concessao('c4', 'Rebeca Teste', { etapasExigidas: ['PROTECAO_DE_DADOS'] })],
        },
      },
    });
    await page.goto(`/acessos/reclassificacoes/${ID}`);
    await page.locator('label.radio', { hasText: 'Proteção de dados' }).click();
    await marcar(page, 'Rebeca Teste');
    await liberar(page).click();

    await expect(page.getByText('Decisão registrada.')).toBeVisible();
    expect(envios[0]?.corpo).toMatchObject({ etapa: 'PROTECAO_DE_DADOS', concessoes: ['c4'] });
  });

  test('documento não lido leva à leitura, e depois de ler a decisão segue', async ({ page }) => {
    await page.route(DOCUMENTO, (route) =>
      route.request().method() === 'OPTIONS'
        ? route.fulfill({ status: 204, headers: CORS })
        : route.fulfill({
            status: 200,
            headers: CORS,
            json: { url: URL_DO_DOCUMENTO, expiraEm: '2099-01-01T00:00:00Z' },
          }),
    );
    await page.route(URL_DO_DOCUMENTO, (route) =>
      route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4\n%%EOF\n' }),
    );
    const { envios } = await preparar(page, PERMISSOES_DO_DIOGO_SO_APROVA, {
      decisao: [
        {
          status: 422,
          corpo: problema(
            422,
            'uniplus.autorizacao.reclassificacao.documento_nao_lido',
            'Document not read',
          ),
        },
        { status: 200, corpo: DECISAO_OK },
      ],
    });
    await page.goto(`/acessos/reclassificacoes/${ID}`);
    await marcar(page, 'Betina Teste');
    await liberar(page).click();

    await expect(page.getByText('O documento instituidor ainda não foi lido.')).toBeVisible();
    await expect(tituloDasVersoes(page)).toBeFocused();
    const abertura = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Abrir o documento da versão 2' }).click();
    await abertura;
    await liberar(page).click();

    await expect(page.getByText('Decisão registrada.')).toBeVisible();
    expect(envios).toHaveLength(2);
    expect(envios[1]?.chave).not.toBe(envios[0]?.chave);
  });

  test('reclassificação superada pede a recarga e tira os botões de decidir', async ({ page }) => {
    const { leituras } = await preparar(page, PERMISSOES_DO_DIOGO_SO_APROVA, {
      decisao: [
        {
          status: 409,
          corpo: problema(409, 'uniplus.autorizacao.reclassificacao.superada', 'Superseded'),
        },
      ],
    });
    await page.goto(`/acessos/reclassificacoes/${ID}`);
    await marcar(page, 'Betina Teste');
    await liberar(page).click();

    await expect(
      page.getByText('Esta reclassificação foi substituída por outra mais recente.'),
    ).toBeVisible();
    await expect(liberar(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Recarregar', exact: true }).click();
    await expect.poll(() => leituras.length).toBe(2);
  });

  test('o catálogo desatualizado na decisão mostra a mensagem inteira e libera nova tentativa', async ({
    page,
  }) => {
    const { envios } = await preparar(page, PERMISSOES_DO_DIOGO_SO_APROVA, {
      decisao: [
        { status: 503, corpo: CATALOGO_DESATUALIZADO },
        { status: 200, corpo: DECISAO_OK },
      ],
    });
    await page.goto(`/acessos/reclassificacoes/${ID}`);
    await marcar(page, 'Betina Teste');
    await liberar(page).click();

    const aviso = page.getByText(MENSAGEM_DO_CATALOGO_DESATUALIZADO).first();
    await expect(aviso).toBeVisible();
    expect(await page.getByText('Tente novamente em instantes.').count()).toBeGreaterThan(0);
    await expect(liberar(page)).toBeEnabled();
    await liberar(page).click();

    await expect(page.getByText('Decisão registrada.')).toBeVisible();
    expect(envios).toHaveLength(2);
  });

  test('quem só mantém perfis é levado ao acesso negado ao abrir a reclassificação', async ({
    page,
  }) => {
    await preparar(page, ['autorizacao:perfis:manter']);
    await page.goto(`/acessos/reclassificacoes/${ID}`);

    await expect(page).toHaveURL(/\/acesso-negado$/);
  });
});

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};
