import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import {
  mockarCatalogos,
  NOME_DOCUMENTO,
  ROTULO_CONVENCAO,
} from '../fixtures/catalogos-do-cronograma';
import { PROCESSO_PUBLICADO_ID, type DetalheMockado } from '../fixtures/cronograma-publicado';
import { irAoPasso } from './navega-passo';
import { mockarProcessoSeletivo } from './processo-mockado';
import { instalarPreferencia, temaDoProject } from './tema';

export interface ProblemasDeIds {
  repetidos: string[];
  orfas: string[];
}

/** Abre o passo Cronograma de um processo novo, com os catálogos do cenário. */
export async function abrirCronogramaEmRascunho(page: Page, testInfo: TestInfo): Promise<void> {
  await mockarCatalogos(page);
  await instalarPreferencia(page, temaDoProject(testInfo.project.name));
  await page.goto('/processo-seletivo/novo');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await irAoPasso(page, 'Cronograma', testInfo);
  await expect(page.getByLabel('Fase do catálogo')).toBeVisible();
}

export async function abrirCronogramaPublicado(
  page: Page,
  testInfo: TestInfo,
  detalhe: DetalheMockado,
): Promise<void> {
  await mockarCatalogos(page);
  await mockarProcessoSeletivo(page, PROCESSO_PUBLICADO_ID, detalhe);
  await instalarPreferencia(page, temaDoProject(testInfo.project.name));
  await page.goto(`/processo-seletivo/${PROCESSO_PUBLICADO_ID}`);
  await expect(page.getByText('Carregando o processo seletivo…')).toBeHidden();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await irAoPasso(page, 'Cronograma', testInfo);
}

/** Acrescenta uma fase do catálogo (Inscrição, por padrão) à linha do tempo. */
export async function acrescentarFase(page: Page, nome = 'Inscrição'): Promise<void> {
  await page.getByLabel('Fase do catálogo').selectOption({ label: nome });
  await page.getByRole('button', { name: 'Acrescentar à linha do tempo' }).click();
}

/** Escolhe no seletor da fase aberta (ou da `dentro` dada) o único documento do catálogo e o exige. */
export async function exigirDocumento(page: Page, dentro: Page | Locator = page): Promise<void> {
  const campo = dentro.getByLabel('Documento a exigir');
  await campo.fill('nome social');
  await page.getByRole('option', { name: NOME_DOCUMENTO }).click();
  await dentro.getByRole('button', { name: 'Acrescentar documento' }).click();
}

/** Declara a única convenção de contagem que o catálogo do cenário oferece. */
export async function declararConvencaoDeContagem(page: Page): Promise<void> {
  await page.getByLabel('Convenção de contagem').selectOption({ label: ROTULO_CONVENCAO });
}

/**
 * Os ids que se repetem na página e as referências (`for`, `aria-describedby`, `aria-controls`)
 * de uma fase que apontam para fora dela. Cada `sel-step-fase` embute o passo da fase (web#923),
 * e o que nasce de um deles não pode colidir com o do vizinho.
 */
export async function problemasDeIds(page: Page): Promise<ProblemasDeIds> {
  return { repetidos: await idsRepetidos(page), orfas: await referenciasOrfas(page) };
}

async function idsRepetidos(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const ids = Array.from(document.querySelectorAll('[id]'), (elemento) => elemento.id);
    return ids.filter((id, posicao) => ids.indexOf(id) !== posicao);
  });
}

async function referenciasOrfas(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('sel-step-fase')).flatMap((fase) =>
      Array.from(fase.querySelectorAll('[for], [aria-describedby], [aria-controls]'))
        .flatMap((elemento) =>
          ['for', 'aria-describedby', 'aria-controls'].flatMap(
            (atributo) => elemento.getAttribute(atributo)?.split(/\s+/) ?? [],
          ),
        )
        .filter((id) => id.startsWith('fase-') && fase.querySelector(`[id="${id}"]`) === null),
    ),
  );
}
