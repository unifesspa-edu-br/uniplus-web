import { expect, test } from '@playwright/test';
import { mockPermissoesEfetivas } from '@uniplus/shared-e2e';
import { PERMISSOES_DO_LEANDRO } from '../support/permissoes';
import {
  abrirFaseDeHabilitacao,
  acrescentarEtapa,
  escolherDocumento,
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

  /**
   * A habilitação do certame regional tem oito etapas e cada uma pede o seu comprovante.
   * Sem dizer qual delas coleta, os oito documentos apareceriam nas oito.
   *
   * A etapa ainda não gravada aparece sem poder ser escolhida: a exigência a referencia
   * pelo identificador que o servidor atribui, e ele só existe depois da gravação. O
   * rótulo diz isso em vez de deixar a opção falhar em silêncio.
   */
  test('o documento aponta a etapa da fase que o coleta', async ({ page }) => {
    await acrescentarEtapa(page);
    await page.getByLabel('Nome', { exact: true }).last().fill('Envio dos comprovantes de renda');

    await escolherDocumento(page, 'Contracheque');
    await page.getByRole('button', { name: 'Acrescentar documento' }).click();

    const coletadoEm = page.getByLabel('Coletado em');
    await expect(coletadoEm).toHaveValue('');
    await expect(coletadoEm).toContainText('Envio dos comprovantes de renda');
    await expect(coletadoEm).toContainText('grave o passo para poder escolher');
  });

  /** A fase que não se subdivide não tem onde coletar senão ela própria. */
  test('fase sem etapa não oferece onde coletar', async ({ page }) => {
    await escolherDocumento(page, 'Contracheque');
    await page.getByRole('button', { name: 'Acrescentar documento' }).click();

    // Escopado ao item: a conferência do passo também nomeia o documento, ao cobrar a norma.
    await expect(page.locator('.doc-item__name').filter({ hasText: 'Contracheque' })).toBeVisible();
    await expect(page.getByLabel('Coletado em')).toHaveCount(0);
  });
});
