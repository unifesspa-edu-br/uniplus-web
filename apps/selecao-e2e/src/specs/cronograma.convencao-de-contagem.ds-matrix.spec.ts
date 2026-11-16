import { expect, test } from '@playwright/test';
import { mockPermissoesEfetivas, runAxeWcagAA } from '@uniplus/shared-e2e';
import { ROTULO_CONVENCAO } from '../fixtures/catalogos-do-cronograma';
import { identificadoresDe } from '../support/medicoes-do-passo';
import { PERMISSOES_DO_LEANDRO } from '../support/permissoes';
import {
  abrirCronogramaEmRascunho,
  acrescentarFase,
  declararConvencaoDeContagem,
} from '../support/passos-do-cronograma';
import { medirTransbordoHorizontal } from '../support/rolagem-do-editor';

test.beforeEach(async ({ page }) => {
  await mockPermissoesEfetivas(page, PERMISSOES_DO_LEANDRO);
});

/**
 * Matriz do Uni+ DS para o passo Cronograma, com foco no seletor da convenção
 * de contagem de prazo (#480): a única superfície nova do passo.
 *
 * O axe roda com a convenção ausente — o estado padrão de um rascunho — e com
 * ela declarada, porque CA-05 promete que nenhuma opção vem pré-selecionada e
 * isso não pode se confirmar só no estado cheio.
 *
 * O CI do frontend sobe Keycloak, mas não a API: os catálogos que a tela
 * consulta são materializados por rota, o que mantém o cenário determinístico.
 */
test.describe('Cronograma — matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await abrirCronogramaEmRascunho(page, testInfo);
  });

  /**
   * A asserção é sobre a coleção inteira. `impact` é severidade do axe, não
   * nível de conformidade: filtrar por ele deixaria passar violação de WCAG
   * 2.1 AA classificada como moderada, num teste que promete o contrário.
   */
  test('não viola WCAG 2.1 AA sem convenção de contagem declarada', async ({ page }) => {
    await acrescentarFase(page);

    const resultado = await runAxeWcagAA(page);

    expect(identificadoresDe(resultado)).toEqual([]);
  });

  test('não viola WCAG 2.1 AA com a convenção de contagem declarada', async ({ page }) => {
    await acrescentarFase(page);
    await declararConvencaoDeContagem(page);

    const resultado = await runAxeWcagAA(page);

    expect(identificadoresDe(resultado)).toEqual([]);
  });

  /** CA-05: ausência é estado válido enquanto rascunho — nenhum default. */
  test('não pré-seleciona nenhuma convenção de contagem', async ({ page }) => {
    await acrescentarFase(page);

    await expect(page.getByLabel('Convenção de contagem')).toHaveValue('');
  });

  /**
   * Nome acessível do seletor pelo rótulo visível (SC 2.5.3), e o texto que o
   * catálogo entrega — código e base legal, nunca um rótulo inventado.
   */
  test('nomeia o seletor pelo rótulo visível e identifica a convenção pelo código', async ({
    page,
  }) => {
    await acrescentarFase(page);

    await expect(page.getByLabel('Convenção de contagem')).toBeVisible();
    await expect(page.locator('#cr-algoritmo-contagem')).toContainText(ROTULO_CONVENCAO);
  });

  /**
   * O que separa uma convenção da outra são os invariantes que o catálogo publica, e é
   * depois da escolha que eles importam — descrevem a convenção escolhida, não as
   * disponíveis.
   */
  test('descreve a convenção escolhida com o que o catálogo publica', async ({ page }) => {
    await acrescentarFase(page);
    await declararConvencaoDeContagem(page);

    const resumo = page.getByText('O que esta convenção faz');
    await expect(resumo).toBeVisible();
    await expect(page.getByText('o dia da âncora não conta')).toBeHidden();

    await resumo.click();
    await expect(page.getByText('o dia da âncora não conta')).toBeVisible();
  });

  test('não transborda horizontalmente', async ({ page }) => {
    await acrescentarFase(page);

    const transbordo = await medirTransbordoHorizontal(page);
    expect(transbordo.documento).toBeLessThanOrEqual(1);
    expect(transbordo.areaDeTrabalho).toBeLessThanOrEqual(1);
  });
});
