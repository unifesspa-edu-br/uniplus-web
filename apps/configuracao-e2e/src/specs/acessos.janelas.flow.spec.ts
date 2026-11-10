import { expect, test, type Page } from '@playwright/test';
import { mockPermissoesEfetivas } from '@uniplus/shared-e2e';
import {
  ERRO_INTERNO,
  CATALOGO_DESATUALIZADO,
  MENSAGEM_DO_CATALOGO_DESATUALIZADO,
  mockRota,
  type Resposta,
} from '../support/api-de-perfis-filas';
import {
  PERMISSOES_DA_BETINA_SO_APROVA,
  PERMISSOES_DO_DIOGO_SO_APROVA,
} from '../support/permissoes';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const PERFIL_ID = '01960000-0000-7000-0000-0000000000a1';
const FILA = /\/api\/autorizacao\/janelas-de-migracao(\?.*)?$/;

const ITEM = {
  perfilId: PERFIL_ID,
  perfilNome: 'Operador de inscrições',
  versaoAlvo: 3,
  prazo: '2026-12-15T15:00:00Z',
  loteEnviado: false,
  quantidadeADecidir: 2,
};

async function abrir(
  page: Page,
  permissoes: readonly string[],
  rota: string,
  respostas: readonly Resposta[],
) {
  await mockConfiguracaoRuntimeConfig(page);
  await mockPermissoesEfetivas(page, permissoes);
  const chamadas = await mockRota(
    page,
    FILA,
    (_chamada, numero) => respostas[Math.min(numero, respostas.length) - 1] as Resposta,
  );
  await page.goto(rota);
  return chamadas;
}

test.describe('Acessos — fila de janelas de migração', () => {
  test('Diogo vê a janela, o prazo, o que decidir e o link para a janela do perfil', async ({
    page,
  }) => {
    const chamadas = await abrir(
      page,
      PERMISSOES_DO_DIOGO_SO_APROVA,
      '/acessos/janelas-de-migracao/gestao-de-acessos',
      [{ status: 200, corpo: [ITEM] }],
    );

    await expect(
      page.getByRole('heading', { name: 'Janelas de migração na gestão de acessos', level: 1 }),
    ).toBeVisible();
    const janela = page.getByRole('link', { name: 'Operador de inscrições' });
    await expect(janela).toHaveAttribute('href', `/acessos/perfis/${PERFIL_ID}/janela`);
    await expect(page.getByText('· versão 3')).toBeVisible();
    await expect(page.getByText('Lote ainda não enviado')).toBeVisible();
    await expect(page.getByText('2 concessões')).toBeVisible();
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]).toMatchObject({
      metodo: 'GET',
      caminho: '/api/autorizacao/janelas-de-migracao',
      consulta: '?etapa=gestao_de_acessos',
    });
  });

  test('Betina lê a fila da proteção de dados com a etapa dela na consulta', async ({ page }) => {
    const chamadas = await abrir(
      page,
      PERMISSOES_DA_BETINA_SO_APROVA,
      '/acessos/janelas-de-migracao/protecao-de-dados',
      [{ status: 200, corpo: [{ ...ITEM, loteEnviado: true, quantidadeADecidir: 1 }] }],
    );

    await expect(page.getByText('Lote enviado')).toBeVisible();
    await expect(page.getByText('1 concessão', { exact: true })).toBeVisible();
    expect(chamadas[0]?.consulta).toBe('?etapa=protecao_de_dados');
  });

  test('fila vazia diz que nenhuma janela aguarda a decisão', async ({ page }) => {
    await abrir(
      page,
      PERMISSOES_DO_DIOGO_SO_APROVA,
      '/acessos/janelas-de-migracao/gestao-de-acessos',
      [{ status: 200, corpo: [] }],
    );

    await expect(page.getByText('Nenhuma janela de migração aguarda a sua decisão.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Operador de inscrições' })).toHaveCount(0);
  });

  test('falha na leitura oferece "Tentar novamente" e a segunda tentativa mostra a fila', async ({
    page,
  }) => {
    const chamadas = await abrir(
      page,
      PERMISSOES_DO_DIOGO_SO_APROVA,
      '/acessos/janelas-de-migracao/gestao-de-acessos',
      [
        { status: 500, corpo: ERRO_INTERNO },
        { status: 200, corpo: [ITEM] },
      ],
    );

    await expect(page.getByText('Não foi possível carregar a fila')).toBeVisible();
    await page.getByRole('button', { name: 'Tentar novamente' }).click();

    await expect(page.getByRole('link', { name: 'Operador de inscrições' })).toBeVisible();
    await expect(page.getByText('Não foi possível carregar a fila')).toHaveCount(0);
    expect(chamadas).toHaveLength(2);
  });

  test('catálogo desatualizado mostra a mensagem inteira, sem duplicar a orientação', async ({
    page,
  }) => {
    await abrir(
      page,
      PERMISSOES_DO_DIOGO_SO_APROVA,
      '/acessos/janelas-de-migracao/gestao-de-acessos',
      [{ status: 503, corpo: CATALOGO_DESATUALIZADO }],
    );

    await expect(page.getByText(MENSAGEM_DO_CATALOGO_DESATUALIZADO).first()).toBeVisible();
    await expect(page.getByText('Catalog out of date')).toHaveCount(0);
  });

  test('o menu oferece a quem só aprova pela gestão de acessos apenas a janela dela', async ({
    page,
  }) => {
    await abrir(
      page,
      PERMISSOES_DO_DIOGO_SO_APROVA,
      '/acessos/janelas-de-migracao/gestao-de-acessos',
      [{ status: 200, corpo: [] }],
    );
    const menu = page.getByRole('navigation', { name: 'Navegação principal' });

    await expect(menu.getByRole('link', { name: 'Janelas na gestão de acessos' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Janelas na proteção de dados' })).toHaveCount(0);
  });

  test('o menu oferece a quem só aprova pela proteção de dados apenas a janela dela', async ({
    page,
  }) => {
    await abrir(
      page,
      PERMISSOES_DA_BETINA_SO_APROVA,
      '/acessos/janelas-de-migracao/protecao-de-dados',
      [{ status: 200, corpo: [] }],
    );
    const menu = page.getByRole('navigation', { name: 'Navegação principal' });

    await expect(menu.getByRole('link', { name: 'Janelas na proteção de dados' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Janelas na gestão de acessos' })).toHaveCount(0);
  });

  test('quem só aprova pela proteção de dados é levada ao acesso negado na fila da gestão de acessos', async ({
    page,
  }) => {
    await abrir(
      page,
      PERMISSOES_DA_BETINA_SO_APROVA,
      '/acessos/janelas-de-migracao/gestao-de-acessos',
      [{ status: 200, corpo: [] }],
    );

    await expect(page).toHaveURL(/\/acesso-negado$/);
  });
});
