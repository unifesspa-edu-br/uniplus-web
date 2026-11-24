import type { CaraterEtapaCodigo } from '@uniplus/shared-data/selecao';
import { expect, test } from '@playwright/test';
import { mockPermissoesEfetivas } from '@uniplus/shared-e2e';
import { PERMISSOES_DO_LEANDRO } from '../support/permissoes';
import {
  abrirFaseDeHabilitacao,
  acrescentarEtapa,
  blocoDaEtapa,
} from '../support/passos-da-etapa-da-fase';

const CARATER = {
  classificatoria: 'CLASSIFICATORIA',
  eliminatoria: 'ELIMINATORIA',
  ambas: 'AMBAS',
} as const satisfies Record<string, `${CaraterEtapaCodigo}`>;

test.beforeEach(async ({ page }) => {
  await mockPermissoesEfetivas(page, PERMISSOES_DO_LEANDRO);
});

/**
 * O que a reformulação do eixo fase → etapa habilita, exercitado de ponta a ponta na
 * tela: qualquer fase se subdivide em etapas, e cada etapa declara o que publica e que
 * recursos admite.
 *
 * O CI do frontend sobe Keycloak, mas não a API: os catálogos são materializados por
 * rota, e o `PUT /etapas` é interceptado para conferir o comando que a tela monta — que
 * é o contrato de verdade entre as duas pontas.
 */

test.describe('Etapa da fase — o que ela publica e que recurso admite', () => {
  test.beforeEach(async ({ page }) => {
    await abrirFaseDeHabilitacao(page);
  });

  /**
   * Antes do vínculo, só a fase que o cadastro marcava como agrupadora recebia etapa —
   * e a habilitação com oito etapas, que todas as planilhas do CEPS descrevem, não tinha
   * onde existir.
   */
  test('fase não agrupadora recebe etapa', async ({ page }) => {
    await acrescentarEtapa(page);

    await expect(page.getByLabel('Nome', { exact: true }).last()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'O que esta etapa publica' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Quem julga esta etapa' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Recursos que esta etapa admite' }),
    ).toBeVisible();
  });

  /**
   * Peso só aparece quando a etapa pode compor a nota final, e quem diz isso é o tipo, no
   * cadastro: uma análise documental confere conformidade e não atribui nota que entre na média.
   * Antes disso a tela pedia peso em toda etapa, inclusive nas que o cálculo ignora.
   */
  test('tipo que não compõe a nota final não oferece caráter que pontua, nem peso', async ({
    page,
  }) => {
    await acrescentarEtapa(page);
    const etapa = page.locator('.etapa-bloco--aberta').last();

    await etapa.getByLabel('Tipo', { exact: true }).selectOption({ label: 'Análise Documental' });

    const carater = etapa.getByLabel('Caráter', { exact: true });
    await expect(carater.getByRole('option')).toHaveCount(2);
    await expect(carater.locator(`option[value="${CARATER.eliminatoria}"]`)).toHaveCount(1);
    await expect(carater.locator(`option[value="${CARATER.classificatoria}"]`)).toHaveCount(0);
    await expect(carater.locator(`option[value="${CARATER.ambas}"]`)).toHaveCount(0);

    await carater.selectOption(CARATER.eliminatoria);
    await expect(etapa.getByLabel('Peso', { exact: true })).toHaveCount(0);
    await expect(etapa.getByLabel('Nota mínima', { exact: true })).toBeVisible();
  });

  /** Trocar para um tipo que pontua devolve as três escolhas, e o peso volta a fazer sentido. */
  test('tipo que compõe a nota final oferece os três caracteres', async ({ page }) => {
    await acrescentarEtapa(page);
    const etapa = page.locator('.etapa-bloco--aberta').last();

    await etapa.getByLabel('Tipo', { exact: true }).selectOption({ label: 'Prova Objetiva' });

    const carater = etapa.getByLabel('Caráter', { exact: true });
    await expect(carater.getByRole('option'), 'as três escolhas mais "Selecione…"').toHaveCount(4);
    await expect(carater.locator(`option[value="${CARATER.eliminatoria}"]`)).toHaveCount(1);
    await expect(carater.locator(`option[value="${CARATER.classificatoria}"]`)).toHaveCount(1);
    await expect(carater.locator(`option[value="${CARATER.ambas}"]`)).toHaveCount(1);

    await carater.selectOption(CARATER.classificatoria);
    await expect(etapa.getByLabel('Peso', { exact: true })).toBeVisible();
  });

  /**
   * A nota máxima é a escala da etapa com nota lançada: aparece junto do peso ou da nota
   * mínima, e some quando a etapa não tem nota (apto/inapto).
   */
  test('pede a nota máxima só da etapa que tem nota', async ({ page }) => {
    await acrescentarEtapa(page);
    const etapa = page.locator('.etapa-bloco--aberta').last();

    await etapa.getByLabel('Tipo', { exact: true }).selectOption({ label: 'Prova Objetiva' });
    await expect(etapa.getByLabel('Nota máxima', { exact: true })).toHaveCount(0);

    await etapa.getByLabel('Caráter', { exact: true }).selectOption(CARATER.classificatoria);
    await expect(etapa.getByLabel('Nota máxima', { exact: true })).toBeVisible();

    await etapa.getByLabel('Nota máxima', { exact: true }).fill('10');
    await etapa.getByLabel('Caráter', { exact: true }).selectOption(CARATER.eliminatoria);
    await expect(etapa.getByLabel('Nota máxima', { exact: true })).toHaveValue('10');
  });

  /**
   * A forma de avaliação diz como a nota é obtida: a humana pede a regra que consolida as
   * notas dos avaliadores, que o catálogo da API publica, e o passo do lançamento. A objetiva
   * não tem nenhum dos dois.
   */
  test('a avaliação humana pede a regra de consolidação e o passo', async ({ page }) => {
    await acrescentarEtapa(page);
    const etapa = page.locator('.etapa-bloco--aberta').last();

    await etapa.getByLabel('Tipo', { exact: true }).selectOption({ label: 'Prova Objetiva' });
    await expect(etapa.getByRole('group', { name: 'Forma de avaliação' })).toHaveCount(0);

    await etapa.getByLabel('Caráter', { exact: true }).selectOption(CARATER.classificatoria);
    const forma = etapa.getByRole('group', { name: 'Forma de avaliação' });
    await expect(forma.getByRole('radio')).toHaveCount(2);
    await expect(etapa.getByRole('group', { name: 'Regra de consolidação das notas' })).toHaveCount(
      0,
    );
    await expect(etapa.getByLabel('Passo do lançamento', { exact: true })).toHaveCount(0);

    await forma.getByText('Humana — banca').click();
    const regra = etapa.getByRole('group', { name: 'Regra de consolidação das notas' });
    await expect(regra.getByRole('radio')).toHaveCount(2);
    await expect(regra).toContainText('mais de um avaliador corrige cada candidato');
    await regra.getByText(/CONSOLIDACAO-CORRECAO-INDEPENDENTE/).click();
    await etapa.getByLabel('Nota máxima', { exact: true }).fill('10');
    await etapa.getByLabel('Passo do lançamento', { exact: true }).fill('0,25');

    await expect(regra.getByRole('radio', { name: /CORRECAO-INDEPENDENTE/ })).toBeChecked();
    await expect(etapa.getByLabel('Passo do lançamento', { exact: true })).toHaveValue('0,25');

    await forma.getByText('Objetiva — gabarito ou leitora').click();
    await expect(etapa.getByRole('group', { name: 'Regra de consolidação das notas' })).toHaveCount(
      0,
    );
    await expect(etapa.getByLabel('Passo do lançamento', { exact: true })).toHaveCount(0);

    await forma.getByText('Humana — banca').click();
    await expect(etapa.getByLabel('Passo do lançamento', { exact: true })).toHaveValue('');
    await expect(
      etapa
        .getByRole('group', { name: 'Regra de consolidação das notas' })
        .getByRole('radio', { checked: true }),
    ).toHaveCount(0);
  });

  /**
   * Os itens dividem a nota da etapa em critérios; a soma é conferida contra a nota máxima. A
   * escala de atendimento só existe na avaliação humana e com itens, e com ela o passo do
   * lançamento deixa de existir — a banca escolhe o nível, não digita a nota.
   */
  test('a avaliação humana cadastra itens e a escala de atendimento', async ({ page }) => {
    await acrescentarEtapa(page);
    const etapa = page.locator('.etapa-bloco--aberta').last();

    await etapa.getByLabel('Tipo', { exact: true }).selectOption({ label: 'Prova Objetiva' });
    await etapa.getByLabel('Caráter', { exact: true }).selectOption(CARATER.classificatoria);
    await etapa.getByLabel('Nota máxima', { exact: true }).fill('10');

    const itens = etapa.getByRole('group', { name: 'Itens de avaliação', exact: true });
    await itens.getByRole('button', { name: 'Acrescentar item' }).click();
    const primeiro = itens.getByRole('group', { name: 'Item 1' });
    await expect(primeiro.getByLabel('Rótulo')).toBeFocused();
    await primeiro.getByLabel('Rótulo').fill('Clareza');
    await primeiro.getByLabel('Pontuação máxima').fill('4');

    await expect(itens.getByText('Soma dos itens: 4 de 10')).toBeVisible();
    await expect(itens.getByText(/precisa ser igual à nota máxima/)).toBeVisible();

    await itens.getByRole('button', { name: 'Acrescentar item' }).click();
    const segundo = itens.getByRole('group', { name: 'Item 2' });
    await segundo.getByLabel('Rótulo').fill('Método');
    await segundo.getByLabel('Pontuação máxima').fill('6');

    await expect(itens.getByText('Soma dos itens: 10 de 10')).toBeVisible();
    await expect(itens.getByText(/precisa ser igual à nota máxima/)).toHaveCount(0);
    await expect(itens.getByRole('button', { name: 'Remover o item Método' })).toBeVisible();

    await expect(etapa.getByRole('group', { name: 'Escala de atendimento' })).toHaveCount(0);

    await etapa
      .getByRole('group', { name: 'Forma de avaliação' })
      .getByText('Humana — banca')
      .click();
    await etapa.getByLabel('Passo do lançamento', { exact: true }).fill('0,5');
    const escala = etapa.getByRole('group', { name: 'Escala de atendimento', exact: true });
    await escala.getByRole('button', { name: 'Usar a escala sugerida' }).click();

    await expect(escala.getByRole('group', { name: 'Nível 1' }).getByLabel('Rótulo')).toHaveValue(
      'Atendeu',
    );
    await expect(
      escala.getByRole('group', { name: 'Nível 2' }).getByLabel('Percentual da pontuação'),
    ).toHaveValue('50');
    await expect(
      escala.getByRole('group', { name: 'Nível 3' }).getByLabel('Percentual da pontuação'),
    ).toHaveValue('0');
    await expect(etapa.getByLabel('Passo do lançamento', { exact: true })).toHaveCount(0);

    await itens.getByRole('button', { name: 'Remover o item Método' }).click();
    await itens.getByRole('button', { name: 'Remover o item Clareza' }).click();
    await expect(etapa.getByRole('group', { name: 'Escala de atendimento' })).toHaveCount(0);
    await expect(etapa.getByLabel('Passo do lançamento', { exact: true })).toBeVisible();
  });

  /**
   * A banca da etapa é acrescentada pelo tipo, e cada uma aparece com o nome do tipo e a posição:
   * a lista não marca mais um tipo por caixa de seleção.
   */
  test('a banca é acrescentada pelo tipo e aparece com a posição', async ({ page }) => {
    await acrescentarEtapa(page);

    const bloco = blocoDaEtapa(page, 'Quem julga esta etapa');
    await bloco
      .getByLabel('Tipo da banca a acrescentar', { exact: true })
      .selectOption({ label: 'Banca de análise documental' });
    await bloco.getByRole('button', { name: 'Acrescentar banca' }).click();

    await expect(
      bloco.getByRole('group', { name: 'Banca de análise documental 1', exact: true }),
    ).toBeFocused();
    await expect(bloco.locator('input[type="checkbox"]')).toHaveCount(0);
  });
});
