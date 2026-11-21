import { expect, test } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import { novoServidorDosTiposDeDecisao } from '../support/api-dos-tipos-de-decisao';
import { identificadoresDe, medirTransbordo } from '../support/medicoes-do-passo';
import { irAoPasso } from '../support/navega-passo';
import {
  abrirAEtapa,
  abrirAFase,
  abrirOCronograma,
  GRUPO_DA_FASE,
  grupoDaEtapa,
  grupoDaFase,
  marcar,
} from '../support/passo-das-decisoes';
import { problemasDeIds } from '../support/passos-do-cronograma';
import {
  TIPO_FORA_DO_VOCABULARIO,
  TIPO_RECUSADO,
} from '../support/tipos-do-cenario-fora-do-vocabulario';

/**
 * Declaração dos tipos de decisão da fase e da etapa no Cronograma, de ponta a ponta na tela:
 * marcar, gravar, reabrir o processo e ler o que o servidor guardou, em consulta e em edição.
 *
 * O CI do frontend sobe Keycloak, mas não a API: o processo e as gravações são servidos por rota.
 * O servidor simulado guarda o que a tela envia e o devolve em ordem alfabética do código, como a
 * API; recusa um código específico e aceita os demais, inclusive os que a tela não conhece.
 */

test.describe('Decisões da fase e da etapa — matriz DS @ds', () => {
  test('grava os tipos marcados na fase e na etapa em ordem alfabética do código', async ({
    page,
  }, testInfo) => {
    const servidor = novoServidorDosTiposDeDecisao('rascunho');
    await abrirOCronograma(page, testInfo, servidor);
    await abrirAFase(page);
    await abrirAEtapa(page);

    await marcar(grupoDaFase(page), 'Nota da etapa');
    await marcar(grupoDaFase(page), 'Classificação');
    await marcar(grupoDaEtapa(page), 'Gabarito da prova');
    await page.getByRole('button', { name: /Gravar e avançar/ }).click();

    await expect.poll(() => servidor.etapasEnviadas.length).toBeGreaterThan(0);
    expect(servidor.cronogramasEnviados.at(-1)?.[0].tiposDeDecisao).toEqual([
      'CLASSIFICACAO',
      'NOTA_DA_ETAPA',
    ]);
    expect(servidor.etapasEnviadas.at(-1)?.[0].tiposDeDecisao).toEqual(['GABARITO_DA_PROVA']);
  });

  test('devolve marcado o que o servidor guardou ao reabrir o processo', async ({
    page,
  }, testInfo) => {
    const servidor = novoServidorDosTiposDeDecisao('rascunho');
    await abrirOCronograma(page, testInfo, servidor);
    await abrirAFase(page);
    await abrirAEtapa(page);
    await marcar(grupoDaFase(page), 'Heteroidentificação');
    await marcar(grupoDaEtapa(page), 'Nota da etapa');
    await page.getByRole('button', { name: /Gravar e avançar/ }).click();
    await expect.poll(() => servidor.etapasEnviadas.length).toBeGreaterThan(0);

    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await irAoPasso(page, 'Cronograma', testInfo);
    await abrirAFase(page);
    await abrirAEtapa(page);

    await expect(grupoDaFase(page).getByLabel('Heteroidentificação')).toBeChecked();
    await expect(grupoDaFase(page).getByLabel('Classificação')).not.toBeChecked();
    await expect(grupoDaEtapa(page).getByLabel('Nota da etapa')).toBeChecked();
  });

  test('mostra o tipo que o servidor recusou e explica a recusa no resumo da gravação', async ({
    page,
  }, testInfo) => {
    const servidor = novoServidorDosTiposDeDecisao('rascunho', [TIPO_RECUSADO.codigo]);
    await abrirOCronograma(page, testInfo, servidor);
    await abrirAFase(page);

    await expect(grupoDaFase(page).getByLabel('Tipo de decisão não identificado')).toBeChecked();
    await page.getByRole('button', { name: /Gravar e avançar/ }).click();

    await expect(
      page.getByText('Um tipo de decisão enviado não é reconhecido pelo servidor.'),
    ).toBeVisible();
    await expect(page.getByText('uniplus.selecao.motivo_de_decisao.tipo_invalido')).toBeVisible();
    await expect(page.getByText(TIPO_RECUSADO.codigo)).toHaveCount(0);
  });

  test('preserva o tipo que a tela não conhece, nas duas gravações, e o devolve marcado ao reabrir', async ({
    page,
  }, testInfo) => {
    const { codigo } = TIPO_FORA_DO_VOCABULARIO;
    const rotulo = 'Tipo de decisão não identificado';
    const servidor = novoServidorDosTiposDeDecisao('rascunho', [codigo], [codigo]);
    await abrirOCronograma(page, testInfo, servidor);
    await abrirAFase(page);
    await abrirAEtapa(page);
    await expect(grupoDaFase(page).getByLabel(rotulo)).toBeChecked();
    await expect(grupoDaEtapa(page).getByLabel(rotulo)).toBeChecked();
    await expect(grupoDaFase(page).getByRole('checkbox').last()).toHaveAccessibleName(rotulo);
    await expect(grupoDaEtapa(page).getByRole('checkbox').last()).toHaveAccessibleName(rotulo);
    await expect(page.getByText(codigo)).toHaveCount(0);

    await marcar(grupoDaFase(page), 'Classificação');
    await marcar(grupoDaEtapa(page), 'Nota da etapa');
    await page.getByRole('button', { name: /Gravar e avançar/ }).click();
    await expect.poll(() => servidor.etapasEnviadas.length).toBeGreaterThan(0);

    expect(servidor.cronogramasEnviados.at(-1)?.[0].tiposDeDecisao).toEqual([
      'CLASSIFICACAO',
      codigo,
    ]);
    expect(servidor.etapasEnviadas.at(-1)?.[0].tiposDeDecisao).toEqual(['NOTA_DA_ETAPA', codigo]);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await irAoPasso(page, 'Cronograma', testInfo);
    await abrirAFase(page);
    await abrirAEtapa(page);
    await expect(grupoDaFase(page).getByLabel(rotulo)).toBeChecked();
    await expect(grupoDaEtapa(page).getByLabel(rotulo)).toBeChecked();
  });

  test('lê em texto, sem caixas de marcar, o que o processo publicado declara', async ({
    page,
  }, testInfo) => {
    const servidor = novoServidorDosTiposDeDecisao('publicado', [
      'CLASSIFICACAO',
      TIPO_FORA_DO_VOCABULARIO.codigo,
    ]);
    await abrirOCronograma(page, testInfo, servidor);

    await expect(page.getByText(GRUPO_DA_FASE, { exact: true })).toBeVisible();
    const decisoesDaFase = page.locator('sel-decisoes-da-fase');
    await expect(decisoesDaFase.getByText('Classificação', { exact: true })).toBeVisible();
    await expect(
      decisoesDaFase.getByText('Tipo de decisão não identificado', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Nenhuma decisão declarada')).toBeVisible();
    await expect(grupoDaFase(page)).toHaveCount(0);
    await expect(grupoDaEtapa(page)).toHaveCount(0);
  });

  test('não viola WCAG 2.1 AA, nomeia cada caixa e não repete id', async ({ page }, testInfo) => {
    const servidor = novoServidorDosTiposDeDecisao('rascunho', ['CLASSIFICACAO']);
    await abrirOCronograma(page, testInfo, servidor);
    await abrirAFase(page);
    await abrirAEtapa(page);
    await marcar(grupoDaEtapa(page), 'Nota da etapa');

    expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);
    for (const grupo of [grupoDaFase(page), grupoDaEtapa(page)]) {
      await expect(grupo.getByRole('checkbox')).toHaveCount(8);
    }
    expect((await problemasDeIds(page)).repetidos).toEqual([]);
  });

  test('não transborda horizontalmente com as opções, uma por linha', async ({
    page,
  }, testInfo) => {
    const servidor = novoServidorDosTiposDeDecisao('rascunho');
    await abrirOCronograma(page, testInfo, servidor);
    await abrirAFase(page);
    await abrirAEtapa(page);

    const medida = await medirTransbordo(page);
    expect(medida.documento).toBeLessThanOrEqual(1);
    expect(medida.scroller).toBeLessThanOrEqual(1);
    const topos = await grupoDaFase(page)
      .locator('label.checkbox')
      .evaluateAll((rotulos) => rotulos.map((rotulo) => rotulo.getBoundingClientRect().top));
    expect(new Set(topos).size).toBe(topos.length);
  });
});
