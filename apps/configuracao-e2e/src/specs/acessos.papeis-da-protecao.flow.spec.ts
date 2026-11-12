import { expect, test, type Page } from '@playwright/test';
import { assertReflowContract, mockPermissoesEfetivas, runAxeWcagAA } from '@uniplus/shared-e2e';
import { UNIDADE_CEPS, mockRota, mockUnidades } from '../support/api-de-perfis-filas';
import {
  PERMISSOES_DA_BETINA_SO_APROVA,
  PERMISSOES_DO_DIOGO_SO_APROVA,
} from '../support/permissoes';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const PERFIL_ID = '01960000-0000-7000-0000-0000000000a1';
const JANELA = `/acessos/perfis/${PERFIL_ID}/janela`;
const VERSOES = '/acessos/versoes-de-perfil/protecao-de-dados';
const JANELAS = '/acessos/janelas-de-migracao/protecao-de-dados';
const QUEM_DECIDE =
  'aguardam a decisão do Representante do controlador sobre a adequação à proteção de dados';

const ITEM = {
  concessaoId: 'c1',
  beneficiarioNome: 'Fernanda Drumond',
  escopoTipo: 'unidade',
  unidadeId: UNIDADE_CEPS,
  validaAte: null,
  versaoAtual: 1,
  acrescimo: ['selecao:processos:aprovar'],
  exigeProtecaoDeDados: true,
  situacao: 'aguardando_protecao_de_dados',
  ehDoLeitor: false,
};

const JANELA_COM_ETAPA_PROTEGIDA = {
  id: 'janela-1',
  perfilId: PERFIL_ID,
  versaoNova: 2,
  versaoAlvo: 2,
  abertaEm: '2026-11-09T12:00:00Z',
  prazo: '2026-12-15T15:00:00Z',
  encerradaEm: null,
  situacao: 'aberta',
  forma: null,
  loteEnviado: true,
  itens: [ITEM],
};

/** Atende as leituras das filas da etapa protegida e da janela do perfil. */
async function abrir(page: Page, permissoes: readonly string[], rota: string): Promise<void> {
  await mockConfiguracaoRuntimeConfig(page);
  await mockPermissoesEfetivas(page, permissoes);
  await mockUnidades(page);
  await mockRota(
    page,
    /\/api\/autorizacao\/(versoes-de-perfil|janelas-de-migracao)(\?.*)?$/,
    () => ({ status: 200, corpo: [] }),
  );
  await mockRota(page, /\/api\/autorizacao\/permissoes(\?.*)?$/, () => ({
    status: 200,
    corpo: [],
  }));
  await mockRota(page, /\/api\/autorizacao\/perfis\/[^/]+\/janela$/, () => ({
    status: 200,
    corpo: JANELA_COM_ETAPA_PROTEGIDA,
  }));
  await page.goto(rota);
}

async function semViolacoes(page: Page): Promise<void> {
  const { violations } = await runAxeWcagAA(page);
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
}

test.describe('Versões e janela — quem decide a etapa de proteção de dados', () => {
  for (const [tela, rota] of [
    ['fila de versões', VERSOES],
    ['fila de janelas', JANELAS],
  ] as const) {
    test(`a ${tela} da etapa protegida nomeia o Representante do controlador, sem violação WCAG`, async ({
      page,
    }) => {
      await abrir(page, PERMISSOES_DA_BETINA_SO_APROVA, rota);

      await expect(page.getByText(QUEM_DECIDE)).toBeVisible();
      await expect(page.locator('main')).not.toContainText('Encarregado');
      await semViolacoes(page);
    });
  }

  test('na janela, a etapa protegida aguarda o Representante do controlador', async ({ page }) => {
    await abrir(page, PERMISSOES_DA_BETINA_SO_APROVA, JANELA);

    const etapa = page.locator('section', {
      has: page.getByRole('heading', { name: 'Etapa da proteção de dados' }),
    });
    await expect(etapa).toContainText('só migram com a decisão do Representante do controlador');
    await expect(etapa.getByText('Aguarda o Representante do controlador')).toBeVisible();
    await expect(etapa.getByText('Passa pelo Representante do controlador.')).toBeVisible();
    await semViolacoes(page);
  });

  test('quem só consulta a janela lê que a decisão cabe ao Representante do controlador', async ({
    page,
  }) => {
    await abrir(page, PERMISSOES_DO_DIOGO_SO_APROVA, JANELA);

    await expect(page.getByText('a decisão cabe ao Representante do controlador')).toBeVisible();
  });

  for (const [nome, largura, altura] of [
    ['320 px', 320, 640],
    ['zoom de 200% (1366 px a 200%)', 683, 384],
  ] as const) {
    test(`a janela se reorganiza sem rolagem horizontal em ${nome}`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: altura });
      await abrir(page, PERMISSOES_DA_BETINA_SO_APROVA, JANELA);
      await expect(page.getByText('Aguarda o Representante do controlador')).toBeVisible();

      await assertReflowContract(page);
    });
  }
});
