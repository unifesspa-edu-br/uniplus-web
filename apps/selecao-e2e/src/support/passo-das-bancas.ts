import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { assertOrdemDeFocoSegueOLeiaute, runAxeWcagAA } from '@uniplus/shared-e2e';
import { mockarServidorDasBancas, type ServidorDasBancas } from './api-das-bancas';
import { identificadoresDe, medirTransbordo } from './medicoes-do-passo';
import { irAoPasso } from './navega-passo';
import { abrirAEtapa, abrirAFase, entrarNoCronograma } from './passo-das-decisoes';
import { problemasDeIds } from './passos-do-cronograma';

export { abrirAEtapa, abrirAFase };

/** A lista de bancas da fase e a da etapa: o mesmo componente, uma de cada lado do cronograma. */
export const listaDaFase = (page: Page): Locator =>
  page.locator('sel-bancas-da-fase sel-lista-de-bancas');
export const listaDaEtapa = (page: Page): Locator =>
  page.locator('sel-bancas-da-etapa sel-lista-de-bancas');

/** A banca pelo nome que a tela lhe dá: o rótulo do tipo e a posição entre as do mesmo tipo. */
export const bancaDaLista = (lista: Locator, identificacao: string): Locator =>
  lista.getByRole('group', { name: identificacao, exact: true });

/** O anúncio que a lista faz, por região viva, a cada banca acrescentada, retirada ou movida. */
export const anuncioDaLista = (lista: Locator): Locator =>
  lista.locator('div[role="status"][aria-live="polite"]').first();

export const seletorDoTipo = (lista: Locator): Locator =>
  lista.getByLabel('Tipo da banca a acrescentar');

/** Escolhe o tipo no seletor e aciona "Acrescentar banca". */
export async function acrescentarBanca(lista: Locator, rotuloDoTipo: string): Promise<void> {
  await seletorDoTipo(lista).selectOption({ label: rotuloDoTipo });
  await lista.getByRole('button', { name: 'Acrescentar banca' }).click();
}

export const botaoDeRetirar = (lista: Locator, identificacao: string): Locator =>
  lista.getByRole('button', { name: `Retirar a ${identificacao}`, exact: true });

/** O botão que troca a banca de lugar com a vizinha do mesmo tipo, pelo nome completo dele. */
export function botaoDeMover(
  lista: Locator,
  banca: string,
  sentido: 'antes' | 'depois',
  vizinha: string,
): Locator {
  const nome = `Mover para ${sentido}: ${banca}, ${sentido} da ${vizinha}`;
  return lista.getByRole('button', { name: nome, exact: true });
}

/** Abre o passo Cronograma do processo que o servidor simulado serve. */
export async function abrirOCronogramaDasBancas(
  page: Page,
  testInfo: TestInfo,
  servidor: ServidorDasBancas,
): Promise<void> {
  await mockarServidorDasBancas(page, servidor);
  await entrarNoCronograma(page, testInfo);
}

/** Recarrega o processo e volta ao passo Cronograma, para ler o que o servidor guardou. */
export async function reabrirOCronograma(page: Page, testInfo: TestInfo): Promise<void> {
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await irAoPasso(page, 'Cronograma', testInfo);
}

/** Dá "Gravar e avançar" e espera as duas gravações chegarem ao servidor simulado. */
export async function gravarOCronograma(page: Page, servidor: ServidorDasBancas): Promise<void> {
  await page.getByRole('button', { name: /Gravar e avançar/ }).click();
  await expect.poll(() => servidor.etapasEnviadas.length).toBeGreaterThan(0);
}

/** Quantas vezes o texto aparece visível na página: a recusa dita junto do controle não pode repetir. */
export async function vezesNaPagina(page: Page, texto: string): Promise<number> {
  return page.getByText(texto).and(page.locator(':visible')).count();
}

/**
 * O que toda tela de bancas cumpre: nenhuma violação do axe (WCAG 2.1 A e AA), nada que role na
 * horizontal (reflow, medido na largura do project da matriz, 320 px entre elas) e nenhum `id`
 * repetido.
 */
export async function conferirAcessibilidadeDaTela(page: Page): Promise<void> {
  expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);
  const medida = await medirTransbordo(page);
  expect(medida.documento).toBeLessThanOrEqual(1);
  expect(medida.scroller).toBeLessThanOrEqual(1);
  expect((await problemasDeIds(page)).repetidos).toEqual([]);
}

/** O Tab percorre a lista na ordem em que ela é lida. */
export async function conferirOrdemDeFoco(page: Page, lista: Locator): Promise<void> {
  await assertOrdemDeFocoSegueOLeiaute(lista, page);
}

/** Acessibilidade e ordem de foco da lista, que toda tela de bancas cumpre no estado em que ficou. */
export async function conferirATela(page: Page, lista: Locator): Promise<void> {
  await conferirAcessibilidadeDaTela(page);
  await conferirOrdemDeFoco(page, lista);
}

/** Os identificadores que a API manda junto da causa de uma banca da fase: a fase e a banca. */
export const daBancaDaFase = (servidor: ServidorDasBancas, idDaBanca: string) => [
  { lista: 'fases', identificador: servidor.fase.codigo },
  { lista: 'bancasRequeridas', identificador: idDaBanca },
];

/** Os identificadores da causa de uma banca da etapa: a etapa e a banca. */
export const daBancaDaEtapa = (servidor: ServidorDasBancas, idDaBanca: string) => [
  ...daEtapa(servidor),
  { lista: 'bancas', identificador: idDaBanca },
];

/** O identificador da causa que aponta a etapa inteira, sem banca. */
export const daEtapa = (servidor: ServidorDasBancas) => [
  { lista: 'etapas', identificador: servidor.etapa.id },
];
