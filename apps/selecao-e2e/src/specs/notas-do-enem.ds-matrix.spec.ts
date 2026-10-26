import { expect, test, type Page } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import type { AxeResults } from 'axe-core';
import {
  FERNANDA,
  HELENA,
  KEVIN,
  retornoComConflito,
  retornoSemUmInscrito,
} from '../fixtures/arquivo-do-inep-sintetico';
import {
  ROTA_DA_TELA,
  envio,
  lote,
  problema,
  simularApi,
  type Cenario,
} from '../fixtures/notas-do-enem';
import { instalarPreferencia, temaDoProject } from '../support/tema';

/**
 * Matriz do Uni+ DS para a tela de notas do ENEM, de 320 px a TV e nos temas claro, escuro e de
 * contraste. O nome do processo e os números de inscrição são longos por natureza, e a fixture os
 * usa assim para não medir uma tela mais estreita do que a do operador. Cada estado monta um
 * layout próprio, então cada um é medido e passa pelo axe.
 */
test.describe('Notas do ENEM — matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await instalarPreferencia(page, temaDoProject(testInfo.project.name));
  });

  test('o estado inicial não transborda e não viola WCAG 2.1 AA', async ({ page }) => {
    await abrirComEdicao(page);

    expect(await transbordo(page)).toBe(false);
    expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);
  });

  test('o resultado com ocorrências não transborda e não viola WCAG 2.1 AA', async ({ page }) => {
    await abrirComEdicao(page, {
      lotes: [lote({ ocorrencias: null })],
      envios: [envio()],
    });
    await escolherLeiauteDeRetorno(page);
    await page.locator('input[type="file"]').setInputFiles({
      name: 'retorno-inep-2025-com-um-nome-de-arquivo-bem-longo-para-medir.txt',
      mimeType: 'text/plain',
      buffer: retornoComConflito([FERNANDA, KEVIN, HELENA], HELENA),
    });
    await page.getByRole('button', { name: 'Importar notas' }).click();
    await expect(page.getByRole('heading', { name: 'Resultado da importação' })).toBeVisible();

    expect(await transbordo(page)).toBe(false);
    expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);

    for (const aba of [/^Ausentes/, /^Linhas sem inscrito/, /^Conflitos/]) {
      await page.getByRole('tab', { name: aba }).click();
      expect(await transbordo(page)).toBe(false);
      expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);
    }
  });

  test('a recusa não transborda e não viola WCAG 2.1 AA', async ({ page }) => {
    await abrirComEdicao(page, {
      importar: problema(
        422,
        'arquivo_fora_do_leiaute',
        'Arquivo fora do leiaute',
        'Linha 1, coluna 21.',
      ),
    });
    await escolherLeiauteDeRetorno(page);
    await page.locator('input[type="file"]').setInputFiles({
      name: 'retorno.txt',
      mimeType: 'text/plain',
      buffer: retornoSemUmInscrito([FERNANDA, KEVIN, HELENA], HELENA),
    });
    await page.getByRole('button', { name: 'Importar notas' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Arquivo recusado' })).toBeVisible();

    expect(await transbordo(page)).toBe(false);
    expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);
  });

  /** O estado de erro que o CI reproduz: a API fora do ar, medido em 320 px com texto e ação empilhados. */
  test('a leitura que falha não transborda e não viola WCAG 2.1 AA', async ({ page }) => {
    await simularApi(page, { semApi: true });
    await page.goto(ROTA_DA_TELA);
    await expect(
      page.getByRole('alert').filter({ hasText: 'Não foi possível carregar' }),
    ).toBeVisible();

    expect(await transbordo(page)).toBe(false);
    expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);
  });

  test('mantém um único landmark main', async ({ page }) => {
    await abrirComEdicao(page);

    await expect(page.getByRole('main')).toHaveCount(1);
  });
});

async function abrirComEdicao(page: Page, cenario: Cenario = {}): Promise<void> {
  await simularApi(page, cenario);
  await page.goto(ROTA_DA_TELA);
  await expect(page.getByRole('heading', { level: 1, name: 'Notas do ENEM' })).toBeVisible();
  await page.getByLabel('Edição do ENEM').first().selectOption('2025');
  await page.getByLabel('Edição do ENEM').last().selectOption('2025');
  await expect(page.getByRole('heading', { name: 'Envios gerados desta edição' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lotes importados desta edição' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Carregando' })).toHaveCount(0);
}

/** Com um só leiaute ativo a tela já o escolhe e não mostra o campo; com mais, o operador escolhe. */
async function escolherLeiauteDeRetorno(page: Page): Promise<void> {
  const campo = page.getByLabel('Leiaute do arquivo de retorno');
  if ((await campo.count()) > 0) await campo.selectOption({ index: 1 });
}

/** Compara a largura rolável com a visível: medir o `body` não basta para um filho mais largo que a janela. */
async function transbordo(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const raiz = document.documentElement;
    return raiz.scrollWidth > raiz.clientWidth + 1;
  });
}

function identificadoresDe(resultado: AxeResults): string[] {
  return resultado.violations.map((violacao) => violacao.id);
}
