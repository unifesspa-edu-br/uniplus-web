import { expect, test, type Page } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import { PROCESSO_ID, FASE_DE_COLETA } from '../fixtures/processo-da-revisao';
import { mockarProcesso, mockarAtoPublicado, prepararARevisao } from '../support/api-da-revisao';
import { EnvioDeAnexosMockado } from '../support/envio-de-anexos';
import { identificadoresDe, medirTransbordo } from '../support/medicoes-do-passo';
import { irAoPasso } from '../support/navega-passo';

const TIPO_PDF = 'application/pdf';
const TIPO_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

async function semViolacaoNemTransbordo(page: Page): Promise<void> {
  const resultado = await runAxeWcagAA(page);
  expect(identificadoresDe(resultado)).toEqual([]);

  const medida = await medirTransbordo(page);
  expect(medida.documento).toBeLessThanOrEqual(1);
  expect(medida.scroller).toBeLessThanOrEqual(1);
}

async function escolherOsAnexos(page: Page): Promise<void> {
  await page.locator('#anexos-edital-arquivo').setInputFiles([
    { name: 'cronograma.pdf', mimeType: TIPO_PDF, buffer: Buffer.from('%PDF-1.4 cronograma') },
    { name: 'modelo-de-recurso.docx', mimeType: TIPO_DOCX, buffer: Buffer.from('modelo') },
  ]);
}

test.describe('Revisão e publicação — anexos do ato, matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await prepararARevisao(page, testInfo.project.name);
  });

  test('anexos enviados no rascunho: nome editável, recusa dita no campo, sem violar WCAG 2.1 AA nem transbordar', async ({
    page,
  }, testInfo) => {
    const envios = new EnvioDeAnexosMockado();
    await mockarProcesso(page, { cronogramaFases: [FASE_DE_COLETA] });
    await envios.instalar(page);
    await page.goto(`/processo-seletivo/${PROCESSO_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await irAoPasso(page, 'Revisão e publicação', testInfo);

    await escolherOsAnexos(page);

    const nome = page.getByLabel('Nome do anexo cronograma.pdf', { exact: true });
    const outroNome = page.getByLabel('Nome do anexo modelo-de-recurso.docx', { exact: true });
    await expect(nome).toHaveValue('cronograma');
    await expect(outroNome).toHaveValue('modelo-de-recurso');
    expect(envios.iniciados).toEqual(['cronograma.pdf', 'modelo-de-recurso.docx']);
    expect(envios.recebidos).toEqual([
      { nomeArquivo: 'cronograma.pdf', contentType: TIPO_PDF },
      { nomeArquivo: 'modelo-de-recurso.docx', contentType: TIPO_DOCX },
    ]);
    expect(envios.confirmados).toEqual(['cronograma.pdf', 'modelo-de-recurso.docx']);

    await nome.fill('Cronograma detalhado');
    await expect(nome).not.toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Baixado como “Cronograma detalhado.pdf”.')).toBeVisible();
    await expect(outroNome).toHaveValue('modelo-de-recurso');

    // O nome que o download não aceitaria é dito no campo, ligado a ele para o leitor de tela.
    await nome.fill('pasta/cronograma');
    await expect(nome).toHaveAttribute('aria-invalid', 'true');
    await expect(nome).toHaveAttribute('aria-describedby', /anexo-nome-erro-/);
    await expect(page.getByText(/O nome do anexo não pode ter/)).toBeVisible();
    await expect(outroNome).not.toHaveAttribute('aria-invalid', 'true');
    await semViolacaoNemTransbordo(page);

    await nome.fill('Cronograma detalhado');
    await expect(nome).not.toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText(/O nome do anexo não pode ter/)).toHaveCount(0);
    await semViolacaoNemTransbordo(page);
  });

  test('em consulta, mostra como texto os anexos que a versão vigente publicou', async ({
    page,
  }, testInfo) => {
    await mockarAtoPublicado(page);
    await mockarProcesso(page, { status: 'publicado', cronogramaFases: [FASE_DE_COLETA] });
    await page.goto(`/processo-seletivo/${PROCESSO_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await irAoPasso(page, 'Revisão e publicação', testInfo);

    const anexos = page.locator('sel-anexos-do-edital');
    await expect(anexos.getByText('Cronograma detalhado.pdf')).toBeVisible();
    await expect(anexos.getByText('modelo-de-recurso.pdf', { exact: false }).first()).toBeVisible();
    await expect(anexos.getByRole('textbox')).toHaveCount(0);
    await expect(
      anexos.getByRole('button', { name: /Abrir o anexo Cronograma detalhado/ }),
    ).toBeVisible();

    await semViolacaoNemTransbordo(page);
  });
});
