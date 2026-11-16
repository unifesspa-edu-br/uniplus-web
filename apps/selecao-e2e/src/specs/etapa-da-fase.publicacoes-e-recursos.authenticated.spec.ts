import { expect, test } from '@playwright/test';
import { mockPermissoesEfetivas } from '@uniplus/shared-e2e';
import { PERMISSOES_DO_LEANDRO } from '../support/permissoes';
import {
  abrirBloco,
  abrirFaseDeHabilitacao,
  acrescentarEtapa,
  blocoDaEtapa,
} from '../support/passos-da-etapa-da-fase';

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

  /** Só ato que o catálogo marca como resultado recebe papel no ciclo recursal. */
  test('a etapa declara o que publica, com papel', async ({ page }) => {
    await acrescentarEtapa(page);

    await abrirBloco(page, 'O que esta etapa publica');
    const bloco = blocoDaEtapa(page, 'O que esta etapa publica');
    await bloco.getByRole('button', { name: 'Acrescentar publicação' }).click();
    await bloco.getByLabel('Ato').selectOption('RESULTADO_PRELIMINAR');
    await bloco.getByLabel('Papel').selectOption('PRELIMINAR');

    await expect(bloco.getByLabel('Ato')).toHaveValue('RESULTADO_PRELIMINAR');
    await expect(bloco.getByLabel('Papel')).toHaveValue('PRELIMINAR');
  });

  /**
   * O caso que uma regra por fase tornava inexprimível: a mesma etapa abre duas janelas,
   * com prazos e relógios distintos — uma contra o que ela publica, outra contra a
   * decisão individual que alcança cada candidato.
   */
  test('a etapa abre duas janelas recursais com prazos distintos', async ({ page }) => {
    await acrescentarEtapa(page);

    // Duas publicações preliminares: é contra cada uma que uma janela corre.
    await abrirBloco(page, 'O que esta etapa publica');
    const publica = blocoDaEtapa(page, 'O que esta etapa publica');
    await publica.getByRole('button', { name: 'Acrescentar publicação' }).click();
    await publica.getByLabel('Ato').nth(0).selectOption('RESULTADO_PRELIMINAR');
    await publica.getByLabel('Papel').nth(0).selectOption('PRELIMINAR');
    await publica.getByRole('button', { name: 'Acrescentar publicação' }).click();
    await publica.getByLabel('Ato').nth(1).selectOption('RESULTADO_FINAL');
    await publica.getByLabel('Papel').nth(1).selectOption('PRELIMINAR');

    await abrirBloco(page, 'Recursos que esta etapa admite');
    const recursos = blocoDaEtapa(page, 'Recursos que esta etapa admite');
    await recursos.getByRole('button', { name: 'Acrescentar recurso' }).click();
    await recursos.getByLabel('Prazo', { exact: true }).nth(0).fill('24');
    await recursos.getByLabel('Unidade', { exact: true }).nth(0).selectOption('horas');

    await recursos.getByRole('button', { name: 'Acrescentar recurso' }).click();
    await recursos.getByLabel('Contra qual publicação').nth(1).selectOption('RESULTADO_FINAL');
    await recursos.getByLabel('Prazo', { exact: true }).nth(1).fill('2');
    await recursos.getByLabel('Unidade', { exact: true }).nth(1).selectOption('diasUteis');

    await expect(recursos.getByLabel('Prazo', { exact: true }).nth(0)).toHaveValue('24');
    await expect(recursos.getByLabel('Unidade', { exact: true }).nth(0)).toHaveValue('horas');
    await expect(recursos.getByLabel('Contra qual publicação').nth(0)).toHaveValue(
      'RESULTADO_PRELIMINAR',
    );
    await expect(recursos.getByLabel('Prazo', { exact: true }).nth(1)).toHaveValue('2');
    await expect(recursos.getByLabel('Unidade', { exact: true }).nth(1)).toHaveValue('diasUteis');
    await expect(recursos.getByLabel('Contra qual publicação').nth(1)).toHaveValue(
      'RESULTADO_FINAL',
    );
  });

  /**
   * O efeito suspensivo da janela da etapa. O servidor guarda os quatro valores em colunas
   * próprias e os devolve na leitura, mas a tela não tinha onde declará-los e o comando saía
   * com os quatro em branco: bastava mexer numa data do cronograma para o que estivesse
   * gravado desaparecer. A fase sempre teve estes campos — a etapa recorre nas mesmas
   * condições. Os dois da 2ª instância só existem quando a janela admite instância superior.
   */
  test('a janela da etapa declara por quanto tempo suspende o efeito do ato', async ({ page }) => {
    await acrescentarEtapa(page);

    await abrirBloco(page, 'Recursos que esta etapa admite');
    const recursos = blocoDaEtapa(page, 'Recursos que esta etapa admite');
    await recursos.getByRole('button', { name: 'Acrescentar recurso' }).click();

    await recursos.getByLabel('Suspensividade da 1ª instância — prazo').fill('3');
    await recursos.getByLabel('Suspensividade da 1ª instância — unidade').selectOption('diasUteis');
    // A 2ª instância só tem suspensividade quando a janela admite instância superior.
    const prazoDaSegunda = recursos.getByLabel('Suspensividade da 2ª instância — prazo');
    await expect(prazoDaSegunda).toHaveCount(0);
    const instanciaSuperior = recursos.getByRole('group', {
      name: 'Admite recurso em instância superior?',
    });
    await instanciaSuperior.getByText('Sim', { exact: true }).click();
    await expect(instanciaSuperior.getByRole('radio', { name: 'Sim', exact: true })).toBeChecked();
    await prazoDaSegunda.fill('48');
    await recursos.getByLabel('Suspensividade da 2ª instância — unidade').selectOption('horas');

    await expect(recursos.getByLabel('Suspensividade da 1ª instância — prazo')).toHaveValue('3');
    await expect(recursos.getByLabel('Suspensividade da 1ª instância — unidade')).toHaveValue(
      'diasUteis',
    );
    await expect(recursos.getByLabel('Suspensividade da 2ª instância — prazo')).toHaveValue('48');
    await expect(recursos.getByLabel('Suspensividade da 2ª instância — unidade')).toHaveValue(
      'horas',
    );
  });

  /** Instância sem os dois campos é desativação declarada, e a tela nomeia isso. */
  test('a janela da etapa admite instância sem suspensividade', async ({ page }) => {
    await acrescentarEtapa(page);

    await abrirBloco(page, 'Recursos que esta etapa admite');
    const recursos = blocoDaEtapa(page, 'Recursos que esta etapa admite');
    await recursos.getByRole('button', { name: 'Acrescentar recurso' }).click();

    await expect(recursos.getByLabel('Suspensividade da 1ª instância — unidade')).toHaveValue('');
    await expect(
      recursos.getByLabel('Suspensividade da 1ª instância — unidade').getByRole('option', {
        name: 'Sem suspensividade',
      }),
    ).toHaveCount(1);
  });

  /** A ciência não tem publicação a apontar: o campo do ato sai junto com ela. */
  test('recurso por ciência individual não pede publicação-âncora', async ({ page }) => {
    await acrescentarEtapa(page);
    await abrirBloco(page, 'Recursos que esta etapa admite');
    const recursos = blocoDaEtapa(page, 'Recursos que esta etapa admite');
    await recursos.getByRole('button', { name: 'Acrescentar recurso' }).click();

    await expect(recursos.getByLabel('Contra qual publicação')).toBeVisible();

    await recursos.getByLabel('O prazo corre de').selectOption('cienciaIndividual');

    await expect(recursos.getByLabel('Contra qual publicação')).toHaveCount(0);
  });
});
