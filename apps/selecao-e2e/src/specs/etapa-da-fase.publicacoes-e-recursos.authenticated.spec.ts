import { expect, test, type Locator } from '@playwright/test';
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
 * Marca a opção `opcao` do grupo de escolha de legenda `legenda`, pelo nome que a pessoa lê. O
 * controle nativo é coberto pela anatomia do design system: quem recebe o clique é o rótulo.
 */
async function escolher(recursos: Locator, legenda: string, opcao: string): Promise<void> {
  const grupo = recursos.getByRole('radiogroup', { name: legenda });
  await grupo.getByText(opcao, { exact: true }).click();
}

/** O valor e a unidade do prazo que o grupo de legenda `legenda` reúne, na posição dada. */
function prazo(recursos: Locator, legenda: string, posicao = 0) {
  const grupo = recursos.getByRole('group', { name: legenda }).nth(posicao);
  return {
    valor: grupo.getByLabel('Valor', { exact: true }),
    unidade: grupo.getByLabel('Unidade', { exact: true }),
  };
}

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

  /** Só ato que o catálogo marca como resultado recebe papel no recurso. */
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
   * O caso que uma regra por fase tornava inexprimível: a mesma etapa abre dois recursos,
   * com prazos e relógios distintos — uma contra o que ela publica, outra contra a
   * decisão individual que alcança cada candidato.
   */
  test('a etapa abre dois recursos com prazos distintos', async ({ page }) => {
    await acrescentarEtapa(page);

    // Duas publicações preliminares: é contra cada uma que um recurso corre.
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
    await prazo(recursos, 'Prazo de interposição', 0).valor.fill('24');
    await prazo(recursos, 'Prazo de interposição', 0).unidade.selectOption('horas');

    await recursos.getByRole('button', { name: 'Acrescentar recurso' }).click();
    await recursos.getByLabel('Contra qual publicação').nth(1).selectOption('RESULTADO_FINAL');
    await prazo(recursos, 'Prazo de interposição', 1).valor.fill('2');
    await prazo(recursos, 'Prazo de interposição', 1).unidade.selectOption('diasUteis');

    await expect(prazo(recursos, 'Prazo de interposição', 0).valor).toHaveValue('24');
    await expect(prazo(recursos, 'Prazo de interposição', 0).unidade).toHaveValue('horas');
    await expect(recursos.getByLabel('Contra qual publicação').nth(0)).toHaveValue(
      'RESULTADO_PRELIMINAR',
    );
    await expect(prazo(recursos, 'Prazo de interposição', 1).valor).toHaveValue('2');
    await expect(prazo(recursos, 'Prazo de interposição', 1).unidade).toHaveValue('diasUteis');
    await expect(recursos.getByLabel('Contra qual publicação').nth(1)).toHaveValue(
      'RESULTADO_FINAL',
    );
  });

  /**
   * Os parâmetros do recurso da etapa: o servidor os guarda em colunas próprias e os devolve na
   * leitura, mas a tela não tinha onde declará-los e o comando saía em branco: bastava mexer
   * numa data do cronograma para o que estivesse gravado desaparecer. O prazo da 2ª instância só
   * existe quando o recurso admite instância superior.
   */
  test('o recurso da etapa declara efeito suspensivo, guarda da vaga e prazo da 2ª instância', async ({
    page,
  }) => {
    await acrescentarEtapa(page);

    await abrirBloco(page, 'Recursos que esta etapa admite');
    const recursos = blocoDaEtapa(page, 'Recursos que esta etapa admite');
    await recursos.getByRole('button', { name: 'Acrescentar recurso' }).click();

    await escolher(recursos, 'Efeito suspensivo na 1ª instância', 'Sem efeito suspensivo');
    await escolher(
      recursos,
      'Guarda da vaga em disputa',
      'Guarda a vaga até o resultado definitivo',
    );
    await expect(prazo(recursos, 'Prazo para recorrer em 2ª instância').valor).toHaveCount(0);

    await escolher(recursos, 'Admite instância superior?', 'Sim');
    await prazo(recursos, 'Prazo para recorrer em 2ª instância').valor.fill('48');
    await prazo(recursos, 'Prazo para recorrer em 2ª instância').unidade.selectOption('horas');

    await expect(recursos.getByRole('radio', { name: 'Sem efeito suspensivo' })).toBeChecked();
    await expect(
      recursos.getByRole('radio', { name: 'Guarda a vaga até o resultado definitivo' }),
    ).toBeChecked();
    await expect(prazo(recursos, 'Prazo para recorrer em 2ª instância').valor).toHaveValue('48');
    await expect(prazo(recursos, 'Prazo para recorrer em 2ª instância').unidade).toHaveValue(
      'horas',
    );
  });

  /** Com instância superior a vaga fica sempre guardada: "não guarda" deixa de ser oferecida. */
  test('com instância superior, a guarda da vaga não oferece "não guarda"', async ({ page }) => {
    await acrescentarEtapa(page);
    await abrirBloco(page, 'Recursos que esta etapa admite');
    const recursos = blocoDaEtapa(page, 'Recursos que esta etapa admite');
    await recursos.getByRole('button', { name: 'Acrescentar recurso' }).click();

    await expect(recursos.getByRole('radio', { name: 'Não guarda a vaga' })).toHaveCount(1);

    await escolher(recursos, 'Admite instância superior?', 'Sim');

    await expect(recursos.getByRole('radio', { name: 'Não guarda a vaga' })).toHaveCount(0);
  });

  /** O que a mudança desfaz por conta própria é anunciado, e nada volta sozinho ao desfazer. */
  test('marcar Não retira o prazo da 2ª instância e avisa', async ({ page }) => {
    await acrescentarEtapa(page);
    await abrirBloco(page, 'Recursos que esta etapa admite');
    const recursos = blocoDaEtapa(page, 'Recursos que esta etapa admite');
    await recursos.getByRole('button', { name: 'Acrescentar recurso' }).click();
    await escolher(recursos, 'Admite instância superior?', 'Sim');
    await prazo(recursos, 'Prazo para recorrer em 2ª instância').valor.fill('48');
    await prazo(recursos, 'Prazo para recorrer em 2ª instância').unidade.selectOption('horas');

    await escolher(recursos, 'Admite instância superior?', 'Não');

    await expect(
      recursos.getByRole('group', { name: 'Prazo para recorrer em 2ª instância' }),
    ).toHaveCount(0);
    await expect(recursos.getByRole('status')).toContainText(
      'O prazo da 2ª instância foi retirado porque o recurso não admite instância superior.',
    );
    await escolher(recursos, 'Admite instância superior?', 'Sim');
    await expect(prazo(recursos, 'Prazo para recorrer em 2ª instância').valor).toHaveValue('');
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
