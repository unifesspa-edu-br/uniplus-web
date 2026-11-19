import { expect, test } from '@playwright/test';
import { mockPermissoesEfetivas } from '@uniplus/shared-e2e';
import { ERRO_INTERNO, mockRota } from '../support/api-de-perfis-filas';
import {
  PERMISSOES_DA_BETINA_SO_APROVA,
  PERMISSOES_DO_DIOGO_SO_APROVA,
} from '../support/permissoes';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const PERFIL_ID = '01960000-0000-7000-0000-0000000000a1';
const OUTRO_PERFIL_ID = '01960000-0000-7000-0000-0000000000a2';
const ROTA = /\/api\/autorizacao\/governanca\/divergencias(\?.*)?$/;

const DIVERGENCIAS = [
  {
    id: 'd1',
    perfilId: PERFIL_ID,
    perfilNome: 'Gestão de acessos',
    codigo: 'autorizacao:perfis:manter',
    tipo: 'classificacao',
    de: 'interno',
    para: 'pessoal',
    instante: '2026-11-09T15:00:00Z',
  },
  {
    id: 'd2',
    perfilId: OUTRO_PERFIL_ID,
    perfilNome: 'Operador de inscrições',
    codigo: 'autorizacao:concessoes:administrar',
    tipo: 'composicao_faltante',
    de: null,
    para: 'autorizacao:concessoes:administrar',
    instante: '2026-11-09T16:00:00Z',
  },
];

test.describe('Acessos — divergências da governança', () => {
  test('quem mantém perfis lê as divergências com o tipo, o de e o para', async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
    await mockPermissoesEfetivas(page, ['autorizacao:perfis:manter']);
    const leituras = await mockRota(page, ROTA, () => ({ status: 200, corpo: DIVERGENCIAS }));
    await page.goto('/acessos/governanca/divergencias');

    await expect(
      page.getByRole('heading', { name: 'Divergências da governança', level: 1 }),
    ).toBeVisible();
    const linhas = page.getByRole('row');
    await expect(linhas.filter({ hasText: 'Classificação diferente do catálogo' })).toContainText(
      'InternaDado pessoal',
    );
    await expect(linhas.filter({ hasText: 'Permissão que falta na composição' })).toContainText(
      '—',
    );
    await expect(
      page.getByRole('table').getByRole('link', { name: 'Gestão de acessos' }),
    ).toHaveAttribute('href', `/acessos/perfis/${PERFIL_ID}`);
    expect(leituras).toHaveLength(1);
    expect(leituras[0]).toMatchObject({
      metodo: 'GET',
      caminho: '/api/autorizacao/governanca/divergencias',
    });
  });

  test('a proteção de dados lê as divergências e vê o link de cada perfil', async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
    await mockPermissoesEfetivas(page, PERMISSOES_DA_BETINA_SO_APROVA);
    await mockRota(page, ROTA, () => ({ status: 200, corpo: DIVERGENCIAS }));
    await page.goto('/acessos/governanca/divergencias');

    const linhas = page.getByRole('table').getByRole('row');
    for (const { perfilId, perfilNome, codigo } of DIVERGENCIAS) {
      const link = linhas.filter({ hasText: codigo }).getByRole('link', { name: perfilNome });
      await expect(link).toHaveAttribute('href', `/acessos/perfis/${perfilId}`);
    }
  });

  test('sem divergências, diz que nenhuma foi encontrada', async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
    await mockPermissoesEfetivas(page, ['autorizacao:perfis:manter']);
    await mockRota(page, ROTA, () => ({ status: 200, corpo: [] }));
    await page.goto('/acessos/governanca/divergencias');

    await expect(page.getByText('Nenhuma divergência da governança foi encontrada.')).toBeVisible();
  });

  test('falha na leitura oferece "Tentar novamente"', async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
    await mockPermissoesEfetivas(page, ['autorizacao:perfis:manter']);
    const leituras = await mockRota(page, ROTA, (_c, n) =>
      n === 1 ? { status: 500, corpo: ERRO_INTERNO } : { status: 200, corpo: DIVERGENCIAS },
    );
    await page.goto('/acessos/governanca/divergencias');

    await expect(page.getByText('Não foi possível carregar as divergências')).toBeVisible();
    await page.getByRole('button', { name: 'Tentar novamente' }).click();

    await expect(page.getByRole('table')).toBeVisible();
    expect(leituras).toHaveLength(2);
  });

  test('quem só aprova pela gestão de acessos é levado ao acesso negado', async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
    await mockPermissoesEfetivas(page, PERMISSOES_DO_DIOGO_SO_APROVA);
    await mockRota(page, ROTA, () => ({ status: 200, corpo: [] }));
    await page.goto('/acessos/governanca/divergencias');

    await expect(page).toHaveURL(/\/acesso-negado$/);
  });
});
