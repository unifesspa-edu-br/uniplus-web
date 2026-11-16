import { expect, test, type Page } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import { faseCanonica, mockApiDeFasesCanonicas } from '../support/api-de-fases-canonicas';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

/**
 * Sinalizadores da Fase canônica: "agrupa etapas" e "permite complementação" só são oferecidos
 * quando a fase declara que os admite. A decisão é do cadastro da fase, nunca do código dela:
 * a mesma fase AVALIACAO aparece com e sem o agrupamento conforme o que o servidor informa. API
 * mockada por `page.route`; autenticação real pelo projeto `fluxo-chromium`.
 */

const grupoDoAgrupamento = (page: Page) => page.locator('#cfg-fase-grupo-agrupa');
const grupoDaComplementacao = (page: Page) => page.locator('#cfg-fase-grupo-compl');

async function editar(page: Page, codigo: string): Promise<void> {
  await page.goto('/fases-canonicas');
  await page.getByRole('button', { name: `Editar fase canônica ${codigo}`, exact: true }).click();
  await expect(page.getByText('Editar fase canônica')).toBeVisible();
}

test.describe('Fase canônica — sinalizadores admitidos', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('a fase que admite agrupar etapas oferece só o agrupamento', async ({ page }) => {
    await mockApiDeFasesCanonicas(page, [faseCanonica({ admiteAgruparEtapas: true })]);
    await editar(page, 'AVALIACAO');

    await expect(grupoDoAgrupamento(page)).toBeVisible();
    await expect(grupoDaComplementacao(page)).toHaveCount(0);
  });

  test('a fase que admite complementação oferece só a complementação', async ({ page }) => {
    await mockApiDeFasesCanonicas(page, [
      faseCanonica({ codigo: 'HOMOLOGACAO', nome: 'Homologação', admiteComplementacao: true }),
    ]);
    await editar(page, 'HOMOLOGACAO');

    await expect(grupoDaComplementacao(page)).toBeVisible();
    await expect(grupoDoAgrupamento(page)).toHaveCount(0);
  });

  test('o código AVALIACAO não oferece o agrupamento quando a fase não o admite', async ({
    page,
  }) => {
    await mockApiDeFasesCanonicas(page, [faseCanonica({ codigo: 'AVALIACAO' })]);
    await editar(page, 'AVALIACAO');

    await expect(grupoDoAgrupamento(page)).toHaveCount(0);
    await expect(grupoDaComplementacao(page)).toHaveCount(0);
  });

  test('um código que nenhuma regra fixa oferece os dois quando a fase admite ambos', async ({
    page,
  }) => {
    const fase = faseCanonica({
      codigo: 'ENTREVISTA_ESPECIAL',
      nome: 'Entrevista especial',
      admiteAgruparEtapas: true,
      admiteComplementacao: true,
    });
    await mockApiDeFasesCanonicas(page, [fase]);
    await editar(page, 'ENTREVISTA_ESPECIAL');

    await expect(grupoDoAgrupamento(page)).toBeVisible();
    await expect(grupoDaComplementacao(page)).toBeVisible();
    await expect(grupoDoAgrupamento(page)).not.toContainText(/AVALIACAO/);
    await expect(grupoDaComplementacao(page)).not.toContainText(/HOMOLOGACAO|RECURSOS/);
  });

  test('o valor lido dos sinalizadores volta no comando de atualização', async ({ page }) => {
    const fase = faseCanonica({
      agrupaEtapas: true,
      permiteComplementacao: true,
      admiteAgruparEtapas: true,
      admiteComplementacao: true,
    });
    const atualizacoes = await mockApiDeFasesCanonicas(page, [fase]);
    await editar(page, fase.codigo);
    await page.getByRole('button', { name: 'Salvar fase canônica' }).click();

    await expect.poll(() => atualizacoes.length).toBe(1);
    expect(atualizacoes[0]).toMatchObject({ agrupaEtapas: true, permiteComplementacao: true });
  });

  test('o formulário com os dois grupos não tem violação WCAG A e AA', async ({ page }) => {
    const fase = faseCanonica({ admiteAgruparEtapas: true, admiteComplementacao: true });
    await mockApiDeFasesCanonicas(page, [fase]);
    await editar(page, fase.codigo);

    expect((await runAxeWcagAA(page)).violations.map((violacao) => violacao.id)).toEqual([]);
  });
});
