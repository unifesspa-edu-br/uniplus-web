import { expect, test } from '@playwright/test';
import { mockPermissoesEfetivas, runAxeWcagAA } from '@uniplus/shared-e2e';
import { RESOLUCAO_PESO_AREA } from '../fixtures/catalogos-da-classificacao';
import {
  PROCESSO_EDICOES_ENEM_ID,
  DETALHE_DESEMPATE_POR_AREA,
} from '../fixtures/processo-classificado';
import {
  abrirProcessoDoCenario,
  abrirProcessoNovo,
  declararFormulaLocal,
} from '../support/consulta-da-classificacao';
import { identificadoresDe } from '../support/medicoes-do-passo';
import { irAoPasso } from '../support/navega-passo';
import { isolarDaApi } from '../support/isolar-da-api';
import { PERMISSOES_DO_LEANDRO } from '../support/permissoes';

test.beforeEach(async ({ page }) => {
  await isolarDaApi(page);
  await mockPermissoesEfetivas(page, PERMISSOES_DO_LEANDRO);
});

/**
 * Matriz do Uni+ DS para classificação, eliminação, bônus e desempate
 * (UNI-REQ-0482). As quatro telas são seletores dirigidos por catálogo,
 * editores dinâmicos por código de regra e listas ordenáveis — a mesma
 * superfície que `configuracao-por-fase.ds-matrix.spec.ts` cobre para o
 * cronograma, e o mesmo motivo de existir: seletor em laço, campo condicional
 * e lista reordenável escondem violação de rótulo e de contraste do template
 * estático.
 *
 * O CI do frontend sobe Keycloak, mas não a API: os catálogos de regra são
 * materializados por rota, o que mantém o cenário determinístico.
 */
test.describe('Classificação, bônus e desempate — matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await abrirProcessoNovo(page, testInfo);
  });

  test.describe('Fórmula e precisão', () => {
    test('não viola WCAG 2.1 AA com fórmula local declarada', async ({ page }, testInfo) => {
      await irAoPasso(page, 'Fórmula e precisão', testInfo);
      await declararFormulaLocal(page);

      const resultado = await runAxeWcagAA(page);
      expect(identificadoresDe(resultado)).toEqual([]);
    });

    test('não viola WCAG 2.1 AA sob classificação importada (sem seção de precisão)', async ({
      page,
    }, testInfo) => {
      await irAoPasso(page, 'Fórmula e precisão', testInfo);
      await page
        .getByLabel('Regra de cálculo', { exact: true })
        .selectOption('CLASSIFICACAO-IMPORTADA|1.0');

      await expect(page.getByLabel('Regra de arredondamento', { exact: true })).toBeHidden();

      const resultado = await runAxeWcagAA(page);
      expect(identificadoresDe(resultado)).toEqual([]);
    });

    test('não viola WCAG 2.1 AA com a resolução de Peso por Área e o quadro à vista', async ({
      page,
    }, testInfo) => {
      await irAoPasso(page, 'Fórmula e precisão', testInfo);
      await declararFormulaLocal(page);
      await page.getByLabel('Classificação baseada em provas').check();
      await page
        .getByLabel('Resolução de Peso por Área', { exact: true })
        .selectOption(RESOLUCAO_PESO_AREA);

      await expect(page.getByRole('table', { name: /Prévia do quadro de pesos/ })).toBeVisible();
      await expect(
        page.getByRole('link', { name: /Abrir o cadastro de Peso por Área/ }),
      ).toBeVisible();

      const resultado = await runAxeWcagAA(page);
      expect(identificadoresDe(resultado)).toEqual([]);
    });

    test('bloqueia o avanço sem a resolução e aponta o campo', async ({ page }, testInfo) => {
      await irAoPasso(page, 'Fórmula e precisão', testInfo);
      await declararFormulaLocal(page);
      await page.getByLabel('Classificação baseada em provas').check();

      await page.getByRole('button', { name: 'Próximo' }).click();

      const seletor = page.getByLabel('Resolução de Peso por Área', { exact: true });
      await expect(seletor).toHaveAttribute('aria-invalid', 'true');
      await expect(page.locator('.step-error')).toContainText(
        'Selecione a resolução de Peso por Área usada na nota, no passo Fórmula.',
      );
    });

    test('declara a escala da nota final, recusa o texto que não é número e aponta o campo', async ({
      page,
    }, testInfo) => {
      await irAoPasso(page, 'Fórmula e precisão', testInfo);
      await declararFormulaLocal(page);
      const escala = page.getByLabel('Escala da nota final', { exact: true });

      await escala.fill('cem');
      await page.getByRole('button', { name: 'Próximo' }).click();

      await expect(escala).toHaveAttribute('aria-invalid', 'true');
      await expect(escala).toHaveAccessibleDescription(/Use apenas números/);
      const comErro = await runAxeWcagAA(page);
      expect(identificadoresDe(comErro)).toEqual([]);

      await escala.fill('1000');
      await expect(escala).not.toHaveAttribute('aria-invalid', 'true');
      const semErro = await runAxeWcagAA(page);
      expect(identificadoresDe(semErro)).toEqual([]);
    });

    test('nomeia cada campo pelo rótulo visível', async ({ page }, testInfo) => {
      await irAoPasso(page, 'Fórmula e precisão', testInfo);
      await declararFormulaLocal(page);

      await expect(page.getByLabel('Regra de cálculo', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Regra de arredondamento', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Casas decimais', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Ordem de alocação', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Escala da nota final', { exact: true })).toBeVisible();
      // O número de opções de curso é do passo Vagas, não da Fórmula.
      await expect(page.getByLabel('Número de opções de curso', { exact: true })).toBeHidden();
    });
  });
});

/**
 * Rascunho classificado pelo ENEM, com inscrição própria e duas edições já declaradas: a Fórmula
 * em edição mostra o bloco das edições aceitas, com a lista, o campo do ano e as ações.
 */
test.describe('Edições do ENEM aceitas na Fórmula em edição — matriz DS @ds', () => {
  test('não viola WCAG 2.1 AA no bloco das edições aceitas', async ({ page }, testInfo) => {
    await abrirProcessoDoCenario(page, testInfo, PROCESSO_EDICOES_ENEM_ID, {
      ...DETALHE_DESEMPATE_POR_AREA,
      id: PROCESSO_EDICOES_ENEM_ID,
      status: 'rascunho',
      opcoesDeclaradas: [
        {
          fatoCodigo: 'EDICAO_ENEM',
          opcoes: [
            { codigo: '2025', rotulo: 'ENEM 2025', ordem: 0 },
            { codigo: '2026', rotulo: 'ENEM 2026', ordem: 1 },
          ],
        },
      ],
    });
    await irAoPasso(page, 'Fórmula e precisão', testInfo);

    const bloco = page.getByRole('group', { name: 'Edições do ENEM aceitas' });
    await expect(bloco).toBeVisible();
    await expect(bloco.getByRole('listitem')).toHaveCount(2);

    const resultado = await runAxeWcagAA(page);
    expect(identificadoresDe(resultado)).toEqual([]);
  });
});
