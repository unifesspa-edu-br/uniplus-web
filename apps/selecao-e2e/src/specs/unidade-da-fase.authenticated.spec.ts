import { expect, test, type Page } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import {
  ID_DA_ADMINISTRADORA,
  UNIDADE_CEPS,
  UNIDADE_CGA,
} from '../fixtures/cenario-da-unidade-da-fase';
import {
  ID_DO_PROCESSO_COMPLETO,
  UNIDADE_RESPONSAVEL_DA_FASE,
} from '../fixtures/processo-publicado-completo';
import { mockarApi, novoCapturado } from '../support/api-da-unidade-da-fase';

/**
 * A unidade que responde por cada fase do cronograma, de ponta a ponta na tela: escolher a
 * unidade, publicar com a fase sem unidade, ser levado até a fase, corrigir e publicar.
 *
 * O CI do frontend sobe Keycloak, mas não a API: o processo, os catálogos e as gravações são
 * servidos por rota, e o `PUT /cronograma-fases` e o `POST /publicacao` são capturados para
 * conferir o comando que a tela monta — o contrato de verdade entre as duas pontas.
 */

async function simularOQuadroDeVagas(page: Page): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Etapas do cadastro' })
    .getByRole('button', { name: 'Vagas' })
    .click();
  await page.getByRole('button', { name: 'Simular o quadro' }).click();
  await expect(page.getByRole('button', { name: 'Simular o quadro' })).toBeEnabled();
}

async function abrirOProcesso(page: Page): Promise<void> {
  await page.goto(`/processo-seletivo/${ID_DO_PROCESSO_COMPLETO}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

async function irAoCronograma(page: Page): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Etapas do cadastro' })
    .getByRole('button', { name: 'Cronograma' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: /^Passo 5:/ })).toBeVisible();
}

test.describe('Unidade responsável da fase no cronograma', () => {
  test('a escolha da unidade segue no comando de gravação do cronograma', async ({ page }) => {
    const capturado = novoCapturado(UNIDADE_RESPONSAVEL_DA_FASE);
    await mockarApi(page, capturado);
    await abrirOProcesso(page);
    await irAoCronograma(page);

    await page.locator('.fase-alternar').first().click();
    const unidade = page.getByLabel('Unidade responsável');
    await expect(unidade).toHaveValue(UNIDADE_CEPS.id);
    await unidade.selectOption({ label: 'CGA — Centro de Gestão Acadêmica' });

    await page.getByRole('button', { name: /Gravar e avançar/ }).click();

    await expect.poll(() => capturado.cronogramas.length).toBeGreaterThan(0);
    expect(capturado.cronogramas.at(-1)?.[0]?.unidadeResponsavelId).toBe(UNIDADE_CGA.id);
  });

  test('a publicação recusada por fase sem unidade leva à fase, e corrigida publica', async ({
    page,
  }) => {
    const capturado = novoCapturado(null);
    await mockarApi(page, capturado);
    await abrirOProcesso(page);
    await simularOQuadroDeVagas(page);

    await page
      .getByRole('navigation', { name: 'Etapas do cadastro' })
      .getByRole('button', { name: 'Revisão e publicação' })
      .click();
    await page.getByLabel('Tipo de ato').selectOption({ index: 1 });
    await page.getByLabel('Órgão').fill('CEPS/Unifesspa');
    await page.getByLabel('Série').fill('Edital de abertura');
    await page.getByLabel('Ano').fill('2027');
    await page.getByLabel('Data do ato').fill('2027-01-15');
    await page.getByLabel('Assinante').fill('Reitor da Unifesspa');

    await page.getByRole('button', { name: 'Publicar', exact: true }).click();
    await page.getByRole('button', { name: 'Publicar processo' }).click();

    const aviso = page.getByText(
      'Toda fase do cronograma precisa de unidade responsável para publicar.',
    );
    await expect(aviso).toBeVisible();
    expect(await runAxeWcagAA(page).then((r) => r.violations.map((v) => v.id))).toEqual([]);

    await page.getByRole('button', { name: /Ir para a fase Inscrição/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: /^Passo 5:/ })).toBeVisible();
    const unidade = page.getByLabel('Unidade responsável');
    await expect(unidade).toBeFocused();
    await expect(page.getByText('Esta fase está sem unidade responsável.')).toBeVisible();
    await expect(unidade).toHaveAttribute('aria-invalid', 'true');

    await unidade.selectOption({ label: 'CGA — Centro de Gestão Acadêmica' });
    await page
      .getByRole('navigation', { name: 'Etapas do cadastro' })
      .getByRole('button', { name: 'Revisão e publicação' })
      .click();
    await page.getByRole('button', { name: 'Publicar', exact: true }).click();
    await page.getByRole('button', { name: 'Publicar processo' }).click();

    await expect.poll(() => capturado.publicado).toBe(true);
    expect(capturado.cronogramas.at(-1)?.[0]?.unidadeResponsavelId).toBe(UNIDADE_CGA.id);
  });

  test('a unidade recusada na gravação aparece no campo da fase', async ({ page }) => {
    const capturado = novoCapturado(UNIDADE_RESPONSAVEL_DA_FASE);
    capturado.recusaDeUnidade = true;
    await mockarApi(page, capturado);
    await abrirOProcesso(page);
    await irAoCronograma(page);

    await page.locator('.fase-alternar').first().click();
    await page.getByRole('button', { name: /Gravar e avançar/ }).click();

    const unidade = page.getByLabel('Unidade responsável');
    await expect(unidade).toHaveAttribute('aria-invalid', 'true');
    await expect(
      page.getByRole('alert').filter({ hasText: 'não está mais no cadastro' }),
    ).toBeVisible();
    expect(await runAxeWcagAA(page).then((r) => r.violations.map((v) => v.id))).toEqual([]);
  });

  test('em consulta, o cronograma lê a unidade gravada na fase', async ({ page }) => {
    const capturado = novoCapturado(UNIDADE_RESPONSAVEL_DA_FASE);
    capturado.publicado = true;
    await mockarApi(page, capturado);
    await abrirOProcesso(page);
    await irAoCronograma(page);

    await expect(page.getByText('CEPS — Centro de Processos Seletivos').first()).toBeVisible();
  });

  test('a fase acrescentada começa pela unidade sugerida, ou pela administradora sem sugestão', async ({
    page,
  }) => {
    await mockarApi(page, novoCapturado(UNIDADE_RESPONSAVEL_DA_FASE));
    await abrirOProcesso(page);
    await irAoCronograma(page);

    for (const [indice, fase, esperada] of [
      [1, 'Habilitação', UNIDADE_CGA.id],
      [2, 'Matrícula', ID_DA_ADMINISTRADORA],
    ] as const) {
      await page.getByLabel('Fase do catálogo').selectOption({ label: fase });
      await page.getByRole('button', { name: 'Acrescentar à linha do tempo' }).click();
      await page.getByRole('button', { name: `${indice + 1}. ${fase}`, exact: true }).click();
      await expect(page.locator(`#cr-unidade-${indice}`)).toHaveValue(esperada);
    }
  });
});
