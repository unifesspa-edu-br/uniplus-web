import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type {
  PerfilDto,
  PerfilListadoDto,
  SituacaoDoAcessoDoPerfilDto,
  SuspensaoDoPerfilDto,
} from '@uniplus/shared-data/autorizacao';
import {
  assertReflowContract,
  mockPermissoesEfetivas,
  runAxeWcagAA,
  type JsonDaApi,
} from '@uniplus/shared-e2e';
import { DETALHE_DO_PERFIL, PERFIL } from '../support/api-de-perfis-escritas';
import { etapaDaVersao } from '../support/enumerados-de-autorizacao';
import { servirLeitura } from '../support/escritas-retidas';
import { PERMISSOES_DO_DIOGO } from '../support/permissoes';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

type VisualTheme = 'light' | 'dark' | 'contrast';

const EM_VIGOR: JsonDaApi<SituacaoDoAcessoDoPerfilDto> = { codigo: 'EM_VIGOR', rotulo: 'Em vigor' };
const SEM_VERSAO_EM_VIGOR: JsonDaApi<SituacaoDoAcessoDoPerfilDto> = {
  codigo: 'SEM_VERSAO_EM_VIGOR',
  rotulo: 'Sem versão em vigor',
};
const SUSPENSO: JsonDaApi<SituacaoDoAcessoDoPerfilDto> = {
  codigo: 'SUSPENSO',
  rotulo: 'Suspenso',
};
const SUSPENSAO: JsonDaApi<SuspensaoDoPerfilDto> = {
  desde: '2026-11-10T11:00:00Z',
  papelDeQuemSuspendeu: etapaDaVersao('GESTAO_DE_ACESSOS'),
  etapasExigidasAgora: [etapaDaVersao('GESTAO_DE_ACESSOS')],
  etapasDecididas: [],
};
const DESATIVADO_DESDE = '2026-11-08T15:00:00Z';

function perfilDaLista(parcial: Partial<JsonDaApi<PerfilListadoDto>>): JsonDaApi<PerfilListadoDto> {
  return { ...PERFIL, ...parcial };
}

const PERFIL_SEM_VERSAO = perfilDaLista({
  id: '01960000-0000-7000-0000-0000000000a2',
  nome: 'Analista de documentos',
  situacaoDoAcesso: SEM_VERSAO_EM_VIGOR,
});
const PERFIL_SUSPENSO = perfilDaLista({
  id: '01960000-0000-7000-0000-0000000000a3',
  nome: 'Atendimento ao candidato',
  ativo: false,
  desativadoDesde: DESATIVADO_DESDE,
  situacaoDoAcesso: SUSPENSO,
  suspensao: SUSPENSAO,
});
const PERFIS_DA_LISTA = [PERFIL, PERFIL_SEM_VERSAO, PERFIL_SUSPENSO];
const DETALHE_SUSPENSO: JsonDaApi<PerfilDto> = {
  ...DETALHE_DO_PERFIL,
  id: PERFIL_SUSPENSO.id,
  nome: PERFIL_SUSPENSO.nome,
  descricao: PERFIL_SUSPENSO.descricao,
  ativo: false,
  desativadoDesde: DESATIVADO_DESDE,
  situacaoDoAcesso: SUSPENSO,
  suspensao: SUSPENSAO,
};

const SITUACAO_DO_PERFIL_SUSPENSO =
  'Suspenso desde 10/11/2026, 08:00 Desativado desde 08/11/2026, 12:00';

function metadataTheme(testInfo: TestInfo): VisualTheme {
  const theme = testInfo.project.metadata['theme'];
  return theme === 'dark' || theme === 'contrast' ? theme : 'light';
}

async function abrirALista(page: Page): Promise<void> {
  await page.goto('/acessos/perfis');
  await expect(page.locator('table tbody tr')).toHaveCount(PERFIS_DA_LISTA.length);
}

async function abrirODetalhe(page: Page): Promise<void> {
  await page.goto(`/acessos/perfis/${DETALHE_SUSPENSO.id}`);
  await expect(page.getByRole('heading', { name: DETALHE_SUSPENSO.nome, level: 1 })).toBeVisible();
  await expect(page.locator('.cfg-tags')).toContainText(SUSPENSO.rotulo);
}

const situacaoNaLista = (page: Page, id: string) =>
  page.locator(`tr[data-perfil-id="${id}"] td[data-label="Situação"]`);

test.describe('Situação do perfil — lista e detalhe', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await mockConfiguracaoRuntimeConfig(page);
    await mockPermissoesEfetivas(page, PERMISSOES_DO_DIOGO);
    await page.addInitScript((theme: VisualTheme) => {
      window.localStorage.setItem(
        'uniplus.a11y',
        JSON.stringify({
          theme: theme === 'contrast' ? 'auto' : theme,
          contrast: theme === 'contrast',
          fontMode: 'default',
        }),
      );
    }, metadataTheme(testInfo));
    await servirLeitura(page, /\/api\/autorizacao\/permissoes(\?.*)?$/, []);
    await servirLeitura(page, /\/api\/autorizacao\/perfis\/[^/?]+\/contencao(\?.*)?$/, []);
    await servirLeitura(page, /\/api\/autorizacao\/perfis(\?.*)?$/, PERFIS_DA_LISTA);
    await servirLeitura(
      page,
      new RegExp(`/api/autorizacao/perfis/${DETALHE_SUSPENSO.id}(\\?.*)?$`),
      DETALHE_SUSPENSO,
    );
  });

  test.describe('lista', () => {
    test('aplica o tema selecionado', async ({ page }, testInfo) => {
      await abrirALista(page);

      await expect(page.locator('html')).toHaveAttribute('data-theme', metadataTheme(testInfo));
    });

    test('mostra o rótulo da API de cada situação, e a data de quem está suspenso', async ({
      page,
    }) => {
      await abrirALista(page);

      await expect(situacaoNaLista(page, PERFIL.id)).toHaveText(EM_VIGOR.rotulo);
      await expect(situacaoNaLista(page, PERFIL_SEM_VERSAO.id)).toHaveText(
        SEM_VERSAO_EM_VIGOR.rotulo,
      );
      await expect(situacaoNaLista(page, PERFIL_SUSPENSO.id)).toHaveText(
        SITUACAO_DO_PERFIL_SUSPENSO,
      );
    });

    test('a cor vem do código da situação e a etiqueta é estática', async ({ page }) => {
      await abrirALista(page);

      await expect(situacaoNaLista(page, PERFIL.id).locator('.tag--success')).toHaveText(
        EM_VIGOR.rotulo,
      );
      await expect(situacaoNaLista(page, PERFIL_SEM_VERSAO.id).locator('.tag--warning')).toHaveText(
        SEM_VERSAO_EM_VIGOR.rotulo,
      );
      await expect(situacaoNaLista(page, PERFIL_SUSPENSO.id).locator('.tag--danger')).toHaveText(
        SUSPENSO.rotulo,
      );
      await expect(page.locator('table [role="status"]')).toHaveCount(0);
    });

    test('não viola WCAG 2.1 A/AA', async ({ page }) => {
      await abrirALista(page);

      const { violations } = await runAxeWcagAA(page);

      expect(
        violations.map((violacao) => violacao.id),
        JSON.stringify(violations, null, 2),
      ).toEqual([]);
    });

    test('cabe a 320 px sem rolagem horizontal', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 720 });
      await abrirALista(page);

      await assertReflowContract(page);
    });
  });

  test.describe('detalhe do perfil suspenso', () => {
    test('mostra o rótulo da API e a data como partes separadas, na cor do código', async ({
      page,
    }) => {
      await abrirODetalhe(page);

      await expect(page.locator('.cfg-tags')).toHaveText(SITUACAO_DO_PERFIL_SUSPENSO);
      await expect(page.locator('.cfg-tags .tag--danger')).toHaveText(SUSPENSO.rotulo);
      await expect(page.locator('.cfg-tags [role="status"]')).toHaveCount(0);
    });

    test('não viola WCAG 2.1 A/AA', async ({ page }) => {
      await abrirODetalhe(page);

      const { violations } = await runAxeWcagAA(page);

      expect(
        violations.map((violacao) => violacao.id),
        JSON.stringify(violations, null, 2),
      ).toEqual([]);
    });

    test('cabe a 320 px sem rolagem horizontal', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 720 });
      await abrirODetalhe(page);

      await assertReflowContract(page);
    });
  });
});
