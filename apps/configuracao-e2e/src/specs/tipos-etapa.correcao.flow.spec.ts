import { expect, test, type Page } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import {
  mockApiDeTiposEtapa,
  novoCapturado,
  tipoDeEtapa,
  type Capturado,
} from '../support/api-de-tipos-etapa';
import { problema } from '../support/escritas-retidas';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';
import { PARECER_FINAL } from '../support/tipos-conceito-api';

/**
 * Correção independente do Tipo de etapa: o tipo declara que as etapas dele são corrigidas por mais
 * de um corretor. Um tipo que exige e outro que não exige provam que a tela mostra, grava e devolve
 * o que o cadastro diz, sem decidir pelo código do tipo. API mockada por `page.route`; autenticação
 * real pelo projeto `fluxo-chromium`.
 */

const COMUM = tipoDeEtapa({ id: '01960000-0000-7000-0000-0000000000e1' });
const EXIGENTE = tipoDeEtapa(
  { id: '01960000-0000-7000-0000-0000000000e2', codigo: 'REDACAO', nome: 'Redação' },
  {
    exigeCorrecaoIndependente: true,
    conceitosAdmitidos: [
      {
        codigo: PARECER_FINAL.codigo,
        nome: PARECER_FINAL.definicao.nome,
        natureza: PARECER_FINAL.definicao.natureza,
      },
    ],
  },
);

const PAGINAS_DE_ERRO = 'https://developers.example.test/erros/';
const CODIGO_SEM_CONCEITO = 'uniplus.configuracao.tipo_etapa.correcao_independente_sem_conceito';
const RECUSA_DA_CORRECAO = {
  ...problema(422, 'uniplus.validacao', 'Dados inválidos', [
    {
      field: 'conceitosAdmitidos',
      code: CODIGO_SEM_CONCEITO,
      message: 'Escolha ao menos um conceito admitido.',
    },
  ]),
  type: `${PAGINAS_DE_ERRO}uniplus.validacao`,
};

const caixaDaCorrecao = (page: Page) =>
  page.getByRole('checkbox', { name: 'Exige correção independente' });
const formulario = (page: Page) =>
  page.getByRole('dialog', { name: 'Formulário de tipo de etapa' });

async function abrirPagina(page: Page, capturado: Capturado, recusa?: object): Promise<void> {
  await mockApiDeTiposEtapa(
    page,
    capturado,
    [COMUM, EXIGENTE],
    recusa && { status: 422, corpo: recusa },
  );
  await page.goto('/tipos-etapa');
  await expect(page.getByRole('heading', { name: 'Tipo de Etapa', level: 1 })).toBeVisible();
}

async function abrirEdicao(page: Page, codigo: string): Promise<void> {
  await page.getByRole('button', { name: `Editar tipo de etapa ${codigo}`, exact: true }).click();
  await expect(formulario(page)).toBeVisible();
}

async function abrirCadastroPreenchido(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Novo tipo de etapa' }).first().click();
  await page.locator('[formControlName="codigo"]').fill('CORRECAO_DA_REDACAO');
  await page.locator('[formControlName="nome"]').fill('Correção da redação');
}

async function recusarACorrecaoSemConceito(page: Page): Promise<void> {
  await abrirPagina(page, novoCapturado(), RECUSA_DA_CORRECAO);
  await abrirCadastroPreenchido(page);
  await page.locator('label.checkbox').filter({ hasText: 'Exige correção independente' }).click();
  await page.getByRole('button', { name: 'Criar tipo de etapa' }).click();
  await expect(formulario(page).locator('#cfg-etapa-conceitos-erro')).toBeVisible();
}

test.describe('Tipo de etapa — correção independente', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('a lista diz, por tipo, se a correção independente é exigida', async ({ page }) => {
    await abrirPagina(page, novoCapturado());

    await expect(page.getByRole('columnheader', { name: 'Correção independente' })).toBeVisible();
    await expect(page.locator('td[data-label="Correção independente"]')).toHaveText([
      'Não exige',
      'Exige',
    ]);
  });

  test('cria o tipo que exige a correção independente, com o conceito escolhido', async ({
    page,
  }) => {
    const capturado = novoCapturado();
    await abrirPagina(page, capturado);
    await abrirCadastroPreenchido(page);

    await expect(caixaDaCorrecao(page)).not.toBeChecked();
    await page.locator('label.checkbox').filter({ hasText: 'Exige correção independente' }).click();
    await page.locator('label.checkbox').filter({ hasText: PARECER_FINAL.definicao.nome }).click();
    await page.getByRole('button', { name: 'Criar tipo de etapa' }).click();

    await expect.poll(() => capturado.posts.length).toBe(1);
    expect(capturado.posts[0]).toMatchObject({
      codigo: 'CORRECAO_DA_REDACAO',
      avaliacao: {
        exigeCorrecaoIndependente: true,
        conceitosAdmitidos: [PARECER_FINAL.codigo],
      },
    });
  });

  test('o tipo criado sem marcar a correção segue como não exigente', async ({ page }) => {
    const capturado = novoCapturado();
    await abrirPagina(page, capturado);
    await abrirCadastroPreenchido(page);
    await page.getByRole('button', { name: 'Criar tipo de etapa' }).click();

    await expect.poll(() => capturado.posts.length).toBe(1);
    expect(capturado.posts[0]).toMatchObject({
      avaliacao: { exigeCorrecaoIndependente: false },
    });
  });

  test('a edição abre com a escolha do cadastro e grava a escolha nova', async ({ page }) => {
    const capturado = novoCapturado();
    await abrirPagina(page, capturado);
    await abrirEdicao(page, EXIGENTE.codigo);

    await expect(caixaDaCorrecao(page)).toBeChecked();
    await page.locator('label.checkbox').filter({ hasText: 'Exige correção independente' }).click();
    await page.getByRole('button', { name: 'Salvar tipo de etapa' }).click();

    await expect.poll(() => capturado.puts.length).toBe(1);
    expect(capturado.puts[0]).toMatchObject({
      avaliacao: { exigeCorrecaoIndependente: false },
    });
  });

  test('a recusa do servidor aparece junto aos conceitos, com código e página, e com o foco', async ({
    page,
  }) => {
    await recusarACorrecaoSemConceito(page);

    const conceito = formulario(page).getByRole('checkbox', { name: PARECER_FINAL.definicao.nome });
    const recusa = formulario(page).locator('#cfg-etapa-conceitos-erro');
    await expect(conceito).toBeFocused();
    await expect(conceito).toHaveAttribute('aria-invalid', 'true');
    await expect(conceito).toHaveAttribute('aria-describedby', 'cfg-etapa-conceitos-erro');
    await expect(recusa).toContainText('Escolha ao menos um conceito admitido.');
    await expect(recusa).toContainText(CODIGO_SEM_CONCEITO);
    const pagina = recusa.getByRole('link', { name: /Entenda a recusa/ });
    await expect(pagina).toHaveAttribute('href', `${PAGINAS_DE_ERRO}${CODIGO_SEM_CONCEITO}`);
    await expect(pagina).toHaveAttribute('target', '_blank');
  });

  test('o formulário com a recusa visível não tem violação WCAG A e AA', async ({ page }) => {
    await recusarACorrecaoSemConceito(page);

    expect((await runAxeWcagAA(page)).violations.map((violacao) => violacao.id)).toEqual([]);
  });

  test('a 320 px a recusa visível não gera rolagem horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await recusarACorrecaoSemConceito(page);

    const dimensoes = await formulario(page).evaluate((el) => ({
      largura: el.scrollWidth,
      visivel: el.clientWidth,
      documento: document.documentElement.scrollWidth,
      janela: document.documentElement.clientWidth,
    }));
    expect(dimensoes.largura).toBeLessThanOrEqual(dimensoes.visivel);
    expect(dimensoes.documento).toBeLessThanOrEqual(dimensoes.janela);
  });

  test('o formulário com a seção de correção não tem violação WCAG A e AA', async ({ page }) => {
    await abrirPagina(page, novoCapturado());
    await abrirEdicao(page, EXIGENTE.codigo);

    expect((await runAxeWcagAA(page)).violations.map((violacao) => violacao.id)).toEqual([]);
  });
});
