import { expect, test, type Page } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import { PROCESSO_ID, FASE_DE_COLETA } from '../fixtures/processo-da-revisao';
import { ID_DO_PROCESSO_COMPLETO } from '../fixtures/processo-publicado-completo';
import { mockarPublicacaoComEscalaPendente } from '../support/api-da-publicacao-com-escala-pendente';
import { mockarProcesso, prepararARevisao } from '../support/api-da-revisao';
import { identificadoresDe } from '../support/medicoes-do-passo';
import { irAoPasso } from '../support/navega-passo';

async function preencherOAtoDaPublicacao(page: Page): Promise<void> {
  await page.getByLabel('Número do ato (opcional)', { exact: true }).fill('001/2027');
  await page.getByLabel('Tipo de ato', { exact: true }).selectOption('PORTARIA');
  await page.getByLabel('Órgão', { exact: true }).fill('Reitoria');
  await page.getByLabel('Série', { exact: true }).fill('1');
  await page.getByLabel('Ano', { exact: true }).fill('2027');
  await page.getByLabel('Data do ato', { exact: true }).fill('2027-01-15');
  await page.getByLabel('Assinante', { exact: true }).fill('Reitor');
}

async function confirmarAPublicacao(page: Page): Promise<void> {
  const dialogo = page.getByRole('dialog', { name: 'Confirmar a publicação do processo seletivo' });
  await dialogo.getByRole('button', { name: 'Publicar processo' }).click();
}

test.describe('Revisão e publicação — escala da nota final, matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await prepararARevisao(page, testInfo.project.name);
  });

  test('a escala da nota final pendente leva ao campo da fórmula, que aponta a falta', async ({
    page,
  }, testInfo) => {
    await mockarProcesso(page, {
      cronogramaFases: [FASE_DE_COLETA],
      classificacao: {
        id: '01960000-0000-7000-0000-0000000009a1',
        regraCalculo: { codigo: 'FORMULA-MEDIA-PONDERADA', versao: '1.0' },
        regraArredondamento: { codigo: 'ARRED-TRUNCAR', versao: '1.0' },
        casasArredondamento: 2,
        regraOrdemAlocacao: { codigo: 'ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA', versao: '1.0' },
        regrasEliminacao: [],
        concorrenciaDuplaAplicavel: false,
        baseadoEmEnem: false,
        escalaNotaFinal: null,
        resolucaoPesoAreaEnem: null,
        quadroPesoAreaEnem: [],
      },
      conformidadeItens: [
        {
          codigo: 'classificacao_escala_nota_final_nao_declarada',
          dimensao: 'classificacao',
          mensagem: 'Declare a escala da nota final.',
          ok: false,
        },
      ],
    });
    await page.goto(`/processo-seletivo/${PROCESSO_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await irAoPasso(page, 'Revisão e publicação', testInfo);

    await page.getByRole('button', { name: /Ir para Fórmula de classificação/ }).click();

    const escala = page.getByLabel('Escala da nota final', { exact: true });
    await expect(escala).toHaveAttribute('aria-invalid', 'true');
    await expect(escala).toHaveAccessibleDescription(/Declare a escala da nota final/);
    const resultado = await runAxeWcagAA(page);
    expect(identificadoresDe(resultado)).toEqual([]);
  });

  test('publicar sem a escala é recusado no campo da Fórmula, e com ela a publicação é aceita', async ({
    page,
  }, testInfo) => {
    const recebido = await mockarPublicacaoComEscalaPendente(page);
    await page.goto(`/processo-seletivo/${ID_DO_PROCESSO_COMPLETO}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await irAoPasso(page, 'Revisão e publicação', testInfo);
    await expect(page.getByText('Nenhuma pendência estrutural.')).toBeVisible();
    await preencherOAtoDaPublicacao(page);
    await irAoPasso(page, 'Vagas', testInfo);
    await page.getByRole('button', { name: 'Simular o quadro' }).click();
    await expect(page.getByRole('button', { name: 'Simular o quadro' })).toBeEnabled();
    await irAoPasso(page, 'Revisão e publicação', testInfo);
    await page.getByRole('button', { name: 'Publicar' }).click();
    await confirmarAPublicacao(page);

    await expect(
      page.locator('.revisao-list').getByText('Escala da nota final (fórmula local)'),
    ).toBeVisible();
    expect(recebido.publicou).toBe(false);
    await page.getByRole('button', { name: /Ir para Fórmula de classificação/ }).click();
    const escala = page.getByLabel('Escala da nota final', { exact: true });
    await expect(escala).toHaveAttribute('aria-invalid', 'true');
    await expect(escala).toHaveAccessibleDescription(/Declare a escala da nota final/);

    await escala.fill('100');
    await expect(escala).not.toHaveAttribute('aria-invalid', 'true');
    await irAoPasso(page, 'Revisão e publicação', testInfo);
    await page.getByRole('button', { name: 'Publicar' }).click();
    await confirmarAPublicacao(page);

    await expect.poll(() => recebido.classificacao?.['escalaNotaFinal']).toBe(100);
    await expect.poll(() => recebido.publicou).toBe(true);
    await expect(page.getByRole('button', { name: 'Publicar' })).toHaveCount(0);
  });
});
