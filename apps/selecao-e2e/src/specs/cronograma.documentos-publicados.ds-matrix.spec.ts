import { expect, test } from '@playwright/test';
import { mockPermissoesEfetivas, runAxeWcagAA } from '@uniplus/shared-e2e';
import { NOME_DOCUMENTO, TIPOS_DOCUMENTO } from '../fixtures/catalogos-do-cronograma';
import { DETALHE_DUAS_FASES, DETALHE_PUBLICADO } from '../fixtures/cronograma-publicado';
import { identificadoresDe } from '../support/medicoes-do-passo';
import { abrirCronogramaPublicado, problemasDeIds } from '../support/passos-do-cronograma';
import { PERMISSOES_DO_LEANDRO } from '../support/permissoes';
import { blocosColados } from '../support/ritmo-vertical';
import { medirTransbordoHorizontal } from '../support/rolagem-do-editor';

test.beforeEach(async ({ page }) => {
  await mockPermissoesEfetivas(page, PERMISSOES_DO_LEANDRO);
});

/**
 * Conferência dos documentos de uma fase publicada (web#902, web#905): o resumo mostra todas as
 * regras com os campos recolhidos — cada documento com a quem se aplica, a entrega, a
 * consequência e a coleta, a norma comum uma vez — e, abaixo de cada um, o detalhe lido como
 * texto. Nenhum botão abre campo, e nenhum campo desabilitado aparece.
 */
test.describe('Documentos da fase em consulta — matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await abrirCronogramaPublicado(page, testInfo, DETALHE_PUBLICADO);
    await expect(
      page.getByRole('heading', { name: 'Documentos exigidos nesta fase' }),
    ).toBeVisible();
  });

  test('mostra o que decide cada exigência com os campos recolhidos', async ({ page }) => {
    const tabela = page.getByRole('table', { name: 'Documentos exigidos nesta fase' });
    const autodeclaracao = tabela
      .getByRole('row', { name: /Autodeclaração étnico-racial/ })
      .first();

    await expect(
      tabela.getByRole('row', { name: new RegExp(NOME_DOCUMENTO) }).first(),
    ).toContainText('Todo candidato');
    await expect(autodeclaracao).toContainText('Modalidades LB_PPI');
    await expect(autodeclaracao).toContainText('Facultativa');
    await expect(autodeclaracao).toContainText('Reclassifica para ampla concorrência');
    await expect(autodeclaracao).toContainText('Na fase inteira');
    await expect(page.getByText('Norma de todos os documentos:')).toBeVisible();
    await expect(tabela.locator('button[aria-expanded="true"]')).toHaveCount(0);
    await expect(tabela.locator('select, input, button')).toHaveCount(0);

    const transbordo = await medirTransbordoHorizontal(page);
    expect(transbordo.documento).toBeLessThanOrEqual(1);
    expect(transbordo.areaDeTrabalho).toBeLessThanOrEqual(1);
    expect(await blocosColados(page)).toEqual([]);
    expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);
  });

  /**
   * O detalhe continua ao alcance em consulta, agora como texto: o que a conferência não resume
   * (em que fases vale, o modelo do candidato) fica sob o documento, sem campo desabilitado.
   */
  test('lê o detalhe do documento como texto', async ({ page }) => {
    const detalhe = page.getByRole('group', { name: 'Detalhe de Autodeclaração étnico-racial' });

    await expect(detalhe).toBeVisible();
    await expect(detalhe.getByText('Sobre o documento')).toBeVisible();
    await expect(detalhe.getByText('Exigido em')).toBeVisible();
    await expect(detalhe.getByText('Só em Inscrição')).toBeVisible();
    await expect(detalhe.getByText('Sem modelo')).toBeVisible();
    await expect(detalhe.locator('select, input, textarea, button')).toHaveCount(0);

    const transbordo = await medirTransbordoHorizontal(page);
    expect(transbordo.documento).toBeLessThanOrEqual(1);
    expect(transbordo.areaDeTrabalho).toBeLessThanOrEqual(1);
    expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);
  });

  /**
   * Nenhuma célula do resumo, nem cabeçalho, passa da própria caixa ou da borda da linha: a
   * tabela tem largura fixa, e o que não coubesse sairia por cima da coluna vizinha.
   */
  test('mostra o resumo inteiro em qualquer largura', async ({ page }) => {
    const problemas = await page
      .locator('.doc-conferencia tr:not(.doc-conferencia__campos)')
      .evaluateAll((linhas) =>
        linhas.flatMap((linha) => {
          const limite = linha.getBoundingClientRect();
          return Array.from(linha.querySelectorAll<HTMLElement>('th, td'))
            .filter((celula) => celula.offsetParent !== null)
            .filter(
              (celula) =>
                celula.scrollWidth > celula.clientWidth + 1 ||
                celula.getBoundingClientRect().right > limite.right + 1,
            )
            .map((celula) => celula.dataset['label'] ?? celula.textContent?.trim() ?? '');
        }),
      );

    expect(problemas).toEqual([]);
  });
});

/**
 * Duas fases lidas ao mesmo tempo (web#905, CA-03): o Cronograma em consulta monta um passo da
 * fase por fase, todos à vista. Nenhum id se repete, nenhuma referência sai da própria fase, e
 * o detalhe de cada documento (a descrição do tipo, inclusive) continua alcançável.
 */
test.describe('Cronograma em consulta com duas fases — matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await abrirCronogramaPublicado(page, testInfo, DETALHE_DUAS_FASES);
    await expect(page.locator('sel-step-fase')).toHaveCount(2);
  });

  test('não repete id nem aponta para a fase vizinha', async ({ page }) => {
    const problemas = await problemasDeIds(page);

    expect(problemas.repetidos, 'ids duplicados na página').toEqual([]);
    expect(problemas.orfas, 'referências que saem da própria fase').toEqual([]);
    expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);
  });

  test('lê o detalhe do documento de cada fase, com a descrição do tipo', async ({ page }) => {
    const detalhes = page.getByRole('group', { name: `Detalhe de ${NOME_DOCUMENTO}` });

    await expect(detalhes).toHaveCount(2);
    for (const detalhe of await detalhes.all()) {
      await expect(detalhe).toContainText(TIPOS_DOCUMENTO[0].descricao);
      await expect(detalhe.locator('select, input, textarea, button')).toHaveCount(0);
    }
    // O wizard mantém os outros passos montados e ocultos: só conta o que está à vista.
    const controles = await page
      .locator('.wiz-content')
      .locator('select, input, textarea, button')
      .evaluateAll((itens) => itens.filter((item) => item.checkVisibility()).length);
    expect(controles).toBe(0);

    const transbordo = await medirTransbordoHorizontal(page);
    expect(transbordo.documento).toBeLessThanOrEqual(1);
    expect(transbordo.areaDeTrabalho).toBeLessThanOrEqual(1);
  });

  /**
   * A varredura só vale se enxergar o que procura: um id copiado de outra fase e uma
   * referência que aponta para fora da própria têm de ser acusados.
   */
  test('falha quando um id se repete ou uma referência sai da fase', async ({ page }) => {
    expect(await problemasDeIds(page)).toEqual({ repetidos: [], orfas: [] });

    const idCopiado = await page.evaluate(() => {
      const [primeira, segunda] = Array.from(document.querySelectorAll('sel-step-fase'));
      const id = primeira.querySelector('[id^="fase-"]')?.id ?? '';
      // Sem um id real, a cópia vazia não repetiria nada e a sabotagem passaria em vácuo.
      if (id !== '') {
        segunda.insertAdjacentHTML(
          'beforeend',
          `<span id="${id}"></span><label for="fase-sabotagem-sem-alvo">x</label>`,
        );
      }
      return id;
    });
    expect(idCopiado).not.toBe('');

    const problemas = await problemasDeIds(page);
    expect(problemas.repetidos.length).toBeGreaterThan(0);
    expect(problemas.orfas).toEqual(['fase-sabotagem-sem-alvo']);
  });
});
