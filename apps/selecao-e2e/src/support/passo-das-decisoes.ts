import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { ID_DO_PROCESSO_COMPLETO } from '../fixtures/processo-publicado-completo';
import {
  mockarServidorDosTiposDeDecisao,
  type ServidorDosTiposDeDecisao,
} from './api-dos-tipos-de-decisao';
import { irAoPasso } from './navega-passo';
import { instalarPreferencia, temaDoProject } from './tema';

export const GRUPO_DA_FASE = 'Decisões que esta fase toma';
export const GRUPO_DA_ETAPA = 'Decisões que esta etapa toma';

export const grupoDaFase = (page: Page) => page.getByRole('group', { name: GRUPO_DA_FASE });
export const grupoDaEtapa = (page: Page) => page.getByRole('group', { name: GRUPO_DA_ETAPA });

/** Abre o passo Cronograma do processo que as rotas do cenário já servem. */
export async function entrarNoCronograma(page: Page, testInfo: TestInfo): Promise<void> {
  await instalarPreferencia(page, temaDoProject(testInfo.project.name));
  await page.goto(`/processo-seletivo/${ID_DO_PROCESSO_COMPLETO}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await irAoPasso(page, 'Cronograma', testInfo);
}

/** Abre o processo servido pelo servidor simulado no passo Cronograma. */
export async function abrirOCronograma(
  page: Page,
  testInfo: TestInfo,
  servidor: ServidorDosTiposDeDecisao,
): Promise<void> {
  await mockarServidorDosTiposDeDecisao(page, servidor);
  await entrarNoCronograma(page, testInfo);
}

export async function abrirAFase(page: Page): Promise<void> {
  await page.locator('.fase-alternar').first().click();
}

export async function abrirAEtapa(page: Page): Promise<void> {
  await page.locator('.etapa-resumo').first().click();
  await expect(grupoDaEtapa(page)).toBeVisible();
}

/** O controle nativo é escondido pela anatomia do design system: quem recebe o clique é o rótulo. */
export async function marcar(grupo: Locator, nome: string): Promise<void> {
  await grupo.getByText(nome, { exact: true }).click();
  await expect(grupo.getByLabel(nome)).toBeChecked();
}
