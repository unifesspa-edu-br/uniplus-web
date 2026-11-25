import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import {
  REGRAS_DE_IDENTIFICACAO,
  NOMES_DOS_DOCUMENTOS,
  TIPOS_DE_IDENTIFICACAO,
} from '../fixtures/documentos-de-identificacao';
import {
  ID_DO_PROCESSO_COMPLETO,
  PROCESSO_PUBLICADO_COMPLETO,
  UNIDADE_RESPONSAVEL_DA_FASE,
} from '../fixtures/processo-publicado-completo';
import { VOCABULARIOS_DA_COMPROVACAO } from '../fixtures/vocabularios-da-comprovacao';
import { CORS, mockarApi, novoCapturado } from './api-da-unidade-da-fase';
import { capturarAsExigencias } from './api-das-exigencias-do-processo';
import { identificadoresDe } from './medicoes-do-passo';
import { elementosForaDoCartao } from './limites-do-cartao';
import { irAoPasso } from './navega-passo';
import { responder, responderCatalogos } from './responder';
import { medirTransbordoHorizontal } from './rolagem-do-editor';
import { instalarPreferencia, temaDoProject } from './tema';

export async function prepararCenario(page: Page, testInfo: TestInfo) {
  await mockarApi(page, novoCapturado(UNIDADE_RESPONSAVEL_DA_FASE));
  await responderCatalogos(page, VOCABULARIOS_DA_COMPROVACAO, CORS);
  await responderCatalogos(page, [['configuracao/tipos-documento', TIPOS_DE_IDENTIFICACAO]], CORS);
  await responderDetalhe(page);
  const gravadas = await capturarAsExigencias(page);
  await instalarPreferencia(page, temaDoProject(testInfo.project.name));
  await page.goto(`/processo-seletivo/${ID_DO_PROCESSO_COMPLETO}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await irAoPasso(page, 'Cronograma', testInfo);
  await page.getByRole('button', { name: '1. Inscrição' }).click();
  return gravadas;
}

async function responderDetalhe(page: Page): Promise<void> {
  const detalhe = {
    ...PROCESSO_PUBLICADO_COMPLETO,
    situacao: { codigo: 'RASCUNHO', rotulo: 'Rascunho' },
    regrasDeComprovacao: REGRAS_DE_IDENTIFICACAO,
  };
  await responder(
    page,
    new RegExp(`/api/selecao/processos-seletivos/${ID_DO_PROCESSO_COMPLETO}$`),
    detalhe,
    CORS,
  );
}

export async function combinarDocumentos(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Combinar documentos' }).click();
  for (const nome of NOMES_DOS_DOCUMENTOS)
    await page
      .getByRole('checkbox', { name: nome, exact: true })
      .locator('xpath=ancestor::label')
      .click();
  await page.getByRole('button', { name: 'Criar grupo' }).click();
  await page.getByRole('radio', { name: 'Quantidade mínima' }).check();
  await page.getByRole('spinbutton', { name: 'Quantidade mínima' }).fill('1');
}

export async function conferirAcessibilidade(page: Page): Promise<void> {
  await conferirAxe(page);
  const medida = await medirTransbordoHorizontal(page);
  expect(medida.documento).toBeLessThanOrEqual(1);
  expect(medida.areaDeTrabalho).toBeLessThanOrEqual(1);
  expect(await elementosForaDoCartao(page)).toEqual([]);
}

export async function conferirAxe(page: Page): Promise<void> {
  expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);
}

export async function tabularAte(page: Page, destino: Locator): Promise<void> {
  for (let tentativa = 0; tentativa < 300; tentativa++) {
    if (await destino.evaluate((elemento) => elemento === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('Não foi possível alcançar o controle pelo teclado.');
}
