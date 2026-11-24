import { expect, test } from '@playwright/test';
import { PROCESSO_PUBLICADO_COMPLETO } from '../fixtures/processo-publicado-completo';
import {
  conferirAcessibilidade,
  prepararCenario,
} from '../support/cenario-das-regras-de-comprovacao';
import {
  abrirDocumento,
  escolherPrazoPeloTeclado,
  conferirRecusaDoPrazo,
  gravarExigencias,
  preencherPrazo,
  recusarValorDoPrazo,
} from '../support/conferencia-do-prazo-e-da-validade';

const PRAZO_DE_TRINTA_DIAS = {
  escolha: 'COM_PRAZO',
  valor: 30,
  unidade: 'DIAS',
  referencia: { tipo: 'FIM_DAS_INSCRICOES', data: null, faseId: null },
  efeitoForaDoPrazo: 'RECUSAR_DOCUMENTO',
};

const REFERENCIA_DA_FASE = {
  tipo: 'INICIO_DA_FASE',
  faseId: PROCESSO_PUBLICADO_COMPLETO.cronogramaFases[0].id,
};

const SEM_PRAZO = {
  escolha: 'SEM_PRAZO',
  valor: null,
  unidade: null,
  referencia: null,
  efeitoForaDoPrazo: null,
};

const VALIDADE_EM_DATA_ESPECIFICA = {
  escolha: 'EXIGE_DOCUMENTO_VALIDO',
  referencia: { tipo: 'DATA_ESPECIFICA', data: '2027-01-30', faseId: null },
  efeitoDoVencimento: 'ACEITAR_COM_AVISO',
};

test.describe('Cronograma: prazo de emissão e validade — matriz DS @ds', () => {
  test('pede as escolhas e envia nulas as escolhas ainda não feitas', async ({
    page,
  }, testInfo) => {
    const gravadas = await prepararCenario(page, testInfo);
    await abrirDocumento(page);
    await expect(
      page.getByText('A escolha é obrigatória antes de publicar.').first(),
    ).toBeVisible();
    await expect(page.getByText('A escolha é obrigatória antes de publicar.').last()).toBeVisible();
    await expect(page.getByLabel('Com prazo', { exact: true })).not.toBeChecked();
    await expect(page.getByLabel('Exige documento válido', { exact: true })).not.toBeChecked();
    await conferirAcessibilidade(page);
    const requisitos = await gravarExigencias(page, gravadas);
    expect(requisitos).toMatchObject({ prazoDeEmissao: null, validade: null });
  });

  test('grava prazo de 30 dias até o fim das inscrições', async ({ page }, testInfo) => {
    const gravadas = await prepararCenario(page, testInfo);
    await abrirDocumento(page);
    await preencherPrazo(page);
    await expect(page.getByText(/exatamente na data mínima/)).toBeVisible();
    await expect(page.getByText(/último dia do mês/)).toBeVisible();
    await expect(page.getByText(/O fim das inscrições é o maior término/)).toBeVisible();
    await conferirAcessibilidade(page);
    const requisitos = await gravarExigencias(page, gravadas);
    expect(requisitos).toEqual(expect.objectContaining({ prazoDeEmissao: PRAZO_DE_TRINTA_DIAS }));
  });

  test('grava prazo em meses com início da fase escolhida', async ({ page }, testInfo) => {
    const gravadas = await prepararCenario(page, testInfo);
    await abrirDocumento(page);
    await preencherPrazo(page);
    await page.getByLabel('Unidade do prazo').selectOption('MESES');
    await page.getByLabel('Data de referência').selectOption('INICIO_DA_FASE');
    await page.getByLabel('Fase', { exact: true }).selectOption({ label: 'Inscrição' });
    await conferirAcessibilidade(page);
    const requisitos = await gravarExigencias(page, gravadas);
    expect(requisitos).toMatchObject({
      prazoDeEmissao: { unidade: 'MESES', referencia: REFERENCIA_DA_FASE },
    });
  });

  test('descarta os detalhes ao escolher sem prazo', async ({ page }, testInfo) => {
    const gravadas = await prepararCenario(page, testInfo);
    await abrirDocumento(page);
    await preencherPrazo(page);
    await page.getByLabel('Sem prazo', { exact: true }).check();
    await expect(page.getByLabel('Prazo', { exact: true })).toHaveCount(0);
    await conferirAcessibilidade(page);
    const requisitos = await gravarExigencias(page, gravadas);
    expect(requisitos).toEqual(expect.objectContaining({ prazoDeEmissao: SEM_PRAZO }));
  });

  test('grava validade exigida em uma data específica', async ({ page }, testInfo) => {
    const gravadas = await prepararCenario(page, testInfo);
    await abrirDocumento(page);
    await page.getByLabel('Exige documento válido', { exact: true }).check();
    await page.getByLabel('Data de referência').selectOption('DATA_ESPECIFICA');
    await page.getByLabel('Data específica').fill('2027-01-30');
    await page.getByLabel('Efeito do vencimento').selectOption('ACEITAR_COM_AVISO');
    await conferirAcessibilidade(page);
    const requisitos = await gravarExigencias(page, gravadas);
    expect(requisitos).toEqual(expect.objectContaining({ validade: VALIDADE_EM_DATA_ESPECIFICA }));
  });

  test('mostra a recusa do valor junto ao campo e a limpa ao editar', async ({
    page,
  }, testInfo) => {
    const gravadas = await prepararCenario(page, testInfo);
    recusarValorDoPrazo(gravadas);
    await abrirDocumento(page);
    await preencherPrazo(page);
    await gravarExigencias(page, gravadas);
    await conferirRecusaDoPrazo(page);
    await expect(page.getByLabel('Prazo', { exact: true })).toBeVisible();
  });

  test('mantém os controles acessíveis com ampliação de 200%', async ({ page }, testInfo) => {
    await prepararCenario(page, testInfo);
    await page.setViewportSize({ width: 640, height: 450 });
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2';
    });
    await abrirDocumento(page);
    await preencherPrazo(page);
    await expect(page.getByLabel('Prazo', { exact: true })).toBeVisible();
    await conferirAcessibilidade(page);
  });

  test('permite escolher e preencher o prazo pelo teclado', async ({ page }, testInfo) => {
    await prepararCenario(page, testInfo);
    await escolherPrazoPeloTeclado(page);
    await conferirAcessibilidade(page);
    await expect(page.getByLabel('Prazo', { exact: true })).toBeVisible();
  });
});
