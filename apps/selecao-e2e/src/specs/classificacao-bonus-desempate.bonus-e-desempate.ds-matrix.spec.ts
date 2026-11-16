import { expect, test } from '@playwright/test';
import { mockPermissoesEfetivas, runAxeWcagAA } from '@uniplus/shared-e2e';
import { BASE_LEGAL_BONUS_REGIONAL_ID } from '../fixtures/catalogos-da-classificacao';
import { abrirProcessoNovo } from '../support/consulta-da-classificacao';
import { identificadoresDe } from '../support/medicoes-do-passo';
import { irAoPasso } from '../support/navega-passo';
import { PERMISSOES_DO_LEANDRO } from '../support/permissoes';

test.beforeEach(async ({ page }) => {
  await mockPermissoesEfetivas(page, PERMISSOES_DO_LEANDRO);
});

test.describe('Classificação, bônus e desempate — matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await abrirProcessoNovo(page, testInfo);
  });

  test.describe('Bônus', () => {
    test('não viola WCAG 2.1 AA com bônus declarado', async ({ page }, testInfo) => {
      await irAoPasso(page, 'Bônus', testInfo);
      await page.getByLabel('Aplica o bônus regional', { exact: true }).check();
      await page
        .getByLabel('Regra do bônus', { exact: true })
        .selectOption('BONUS-MULTIPLICATIVO|1.0');
      await page.getByLabel('Fator', { exact: true }).fill('1.2');
      await page
        .getByLabel('Base Legal do bônus', { exact: true })
        .selectOption(BASE_LEGAL_BONUS_REGIONAL_ID);

      const resultado = await runAxeWcagAA(page);
      expect(identificadoresDe(resultado)).toEqual([]);
    });

    test('não viola WCAG 2.1 AA com a conferência acusando', async ({ page }, testInfo) => {
      await irAoPasso(page, 'Bônus', testInfo);
      await page.getByLabel('Aplica o bônus regional', { exact: true }).check();
      await page.getByLabel('Fator', { exact: true }).fill('0');

      const resultado = await runAxeWcagAA(page);
      expect(identificadoresDe(resultado)).toEqual([]);
    });
  });

  test.describe('Desempate', () => {
    test('não viola WCAG 2.1 AA com três variantes de critério na lista', async ({
      page,
    }, testInfo) => {
      await irAoPasso(page, 'Desempate', testInfo);

      // "Regra do critério" se repete uma vez por linha da lista — o mesmo
      // rótulo em cada ocorrência é o comportamento correto de acessibilidade
      // para campos repetidos, e o `.nth()` aqui seleciona a N-ésima linha,
      // não desambigua conceitos diferentes que colidiram por acidente.
      const regraDoCriterio = page.getByLabel('Regra do critério', { exact: true });

      await page.getByRole('button', { name: '+ Acrescentar critério' }).click();
      await regraDoCriterio.nth(0).selectOption('DESEMPATE-MAIOR-IDADE|1.0');

      await page.getByRole('button', { name: '+ Acrescentar critério' }).click();
      await regraDoCriterio.nth(1).selectOption('DESEMPATE-IDOSO|1.0');
      await page.getByLabel('Idade mínima', { exact: true }).fill('60');

      await page.getByRole('button', { name: '+ Acrescentar critério' }).click();
      await regraDoCriterio.nth(2).selectOption('DESEMPATE-PREDICADO-FATO|1.0');
      // Fato, comparação e valor vêm do catálogo institucional: os três são vocabulário
      // fechado do servidor, e antes eram campos de texto que aceitavam "lte" para ser
      // recusado no 422.
      await page.getByLabel('Fato do candidato', { exact: true }).selectOption('RENDA_PER_CAPITA');
      await page.getByLabel('Comparação', { exact: true }).selectOption('MENOR_IGUAL');
      await page.getByLabel('Valor', { exact: true }).fill('1');

      const resultado = await runAxeWcagAA(page);
      expect(identificadoresDe(resultado)).toEqual([]);
    });

    test('reordena por teclado — mover para cima fica indisponível no topo', async ({
      page,
    }, testInfo) => {
      await irAoPasso(page, 'Desempate', testInfo);

      await page.getByRole('button', { name: '+ Acrescentar critério' }).click();
      // O rótulo diz QUAL critério move: numa lista de sete, sete botões "Mover para cima"
      // idênticos não dizem ao leitor de tela o que cada um opera.
      await expect(
        page.getByRole('button', { name: 'Mover o critério 1 para cima' }),
      ).toBeDisabled();
    });
  });
});
