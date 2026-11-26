import { expect, test, type Page } from '@playwright/test';
import { ID_DO_PROCESSO_COMPLETO } from '../fixtures/processo-publicado-completo';
import {
  mockarServidorDaRegraDeHomologacao,
  novoServidorDaRegraDeHomologacao,
  REGRA_DE_HOMOLOGACAO_DO_CENARIO,
} from '../support/api-da-regra-de-homologacao';
import { publicarPelaRevisao, simularOQuadroDeVagas } from '../support/publicacao-do-processo';

/**
 * A regra de homologação das inscrições declarada na fase atravessa, sem mudança, a gravação do
 * passo Cronograma e a publicação, que regrava os passos anteriores. O CI do frontend não sobe a
 * API: o processo e as gravações são servidos por rota, e os comandos capturados são o contrato
 * de verdade entre as duas pontas.
 */

async function abrirOProcesso(page: Page): Promise<void> {
  await page.goto(`/processo-seletivo/${ID_DO_PROCESSO_COMPLETO}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

test.describe('Regra de homologação das inscrições na gravação e na publicação', () => {
  test('gravar o passo Cronograma sem mexer na regra envia a mesma regra', async ({ page }) => {
    const servidor = novoServidorDaRegraDeHomologacao();
    await mockarServidorDaRegraDeHomologacao(page, servidor);
    await abrirOProcesso(page);
    await page
      .getByRole('navigation', { name: 'Etapas do cadastro' })
      .getByRole('button', { name: 'Cronograma' })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: /^Passo 5:/ })).toBeVisible();

    await page.getByRole('button', { name: /Gravar e avançar/ }).click();

    await expect.poll(() => servidor.cronogramasEnviados.length).toBeGreaterThan(0);
    expect(servidor.cronogramasEnviados.at(-1)?.[0]?.regraDeHomologacao).toEqual(
      REGRA_DE_HOMOLOGACAO_DO_CENARIO,
    );
    expect(servidor.fase.publicacoes.regraDeHomologacao).toEqual(REGRA_DE_HOMOLOGACAO_DO_CENARIO);
  });

  test('publicar regrava o cronograma com a mesma regra e a regra continua declarada', async ({
    page,
  }, testInfo) => {
    const servidor = novoServidorDaRegraDeHomologacao();
    await mockarServidorDaRegraDeHomologacao(page, servidor);
    await abrirOProcesso(page);
    await simularOQuadroDeVagas(page, testInfo);

    await publicarPelaRevisao(page, testInfo);

    await expect.poll(() => servidor.publicado).toBe(true);
    expect(servidor.cronogramasEnviados.length).toBeGreaterThan(0);
    for (const corpo of servidor.cronogramasEnviados) {
      expect(corpo[0]?.regraDeHomologacao).toEqual(REGRA_DE_HOMOLOGACAO_DO_CENARIO);
    }
    expect(servidor.fase.publicacoes.regraDeHomologacao).toEqual(REGRA_DE_HOMOLOGACAO_DO_CENARIO);
  });
});
