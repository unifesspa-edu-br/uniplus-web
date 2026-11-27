import { expect, type Page, type TestInfo } from '@playwright/test';
import { mockarCatalogos } from '../fixtures/catalogos-da-classificacao';
import { mockarProcessoSeletivo } from './processo-mockado';
import { instalarPreferencia, temaDoProject } from './tema';

/** As larguras de referência em que a consulta não pode ter rolagem horizontal. */
export const LARGURAS_DE_REFERENCIA = [1440, 768, 375, 320] as const;

/** Abre o assistente de um processo novo, com os catálogos de regra do cenário. */
export async function abrirProcessoNovo(page: Page, testInfo: TestInfo): Promise<void> {
  await mockarCatalogos(page);
  await instalarPreferencia(page, temaDoProject(testInfo.project.name));
  await page.goto('/processo-seletivo/novo');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

/** Abre o processo do cenário e espera a leitura: enquanto carrega, o stepper ignora o clique. */
export async function abrirProcessoDoCenario(
  page: Page,
  testInfo: TestInfo,
  id: string,
  detalhe: unknown,
): Promise<void> {
  await mockarCatalogos(page);
  await mockarProcessoSeletivo(page, id, detalhe);
  await instalarPreferencia(page, temaDoProject(testInfo.project.name));
  await page.goto(`/processo-seletivo/${id}`);
  await expect(page.getByText('Carregando o processo seletivo…')).toBeHidden();
}

/** Espera dois quadros de animação, para medir depois que a troca de largura se assentou. */
export async function esperarLayoutEstavel(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolver) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolver())),
      ),
  );
}

/** A altura da viewport do project, mantida quando o teste troca só a largura. */
export function alturaDoProject(testInfo: TestInfo): number {
  return testInfo.project.use.viewport?.height ?? 900;
}

/**
 * Controles de formulário e botões visíveis no passo aberto. Em consulta não há nenhum: o valor
 * é lido como texto, e um controle desabilitado ainda seria um campo onde não se escreve.
 */
export async function controlesVisiveis(page: Page): Promise<string[]> {
  return page
    .locator('.wiz-content')
    .locator('select, input, textarea, button')
    .evaluateAll((controles) =>
      controles
        .filter((controle) => controle.checkVisibility())
        .map((controle) => controle.id || controle.textContent?.trim() || controle.tagName),
    );
}

/** O valor que a consulta lê sob o rótulo, no passo aberto. */
export function valorEmConsulta(page: Page, rotulo: string) {
  return page
    .locator('.wiz-content .valor-em-consulta:visible')
    .filter({ has: page.locator('dt', { hasText: new RegExp(`^${rotulo}$`) }) })
    .locator('dd')
    .first();
}

/** Fórmula local completa — regra de cálculo, arredondamento, casas e ordem de alocação. */
export async function declararFormulaLocal(page: Page): Promise<void> {
  await page
    .getByLabel('Regra de cálculo', { exact: true })
    .selectOption('FORMULA_MEDIA_PONDERADA|1.0');
  await page
    .getByLabel('Regra de arredondamento', { exact: true })
    .selectOption('ARRED-TRUNCAR|1.0');
  await page.getByLabel('Casas decimais', { exact: true }).fill('2');
  await page
    .getByLabel('Ordem de alocação', { exact: true })
    .selectOption('ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA|1.0');
}
