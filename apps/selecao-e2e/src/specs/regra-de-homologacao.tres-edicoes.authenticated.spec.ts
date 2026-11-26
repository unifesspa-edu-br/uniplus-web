import { expect, test, type Locator, type Page } from '@playwright/test';
import { mockarServidorDaRegraDeHomologacao } from '../support/api-da-regra-de-homologacao';
import {
  DESCRICAO_DO_MOTIVO,
  EDICOES_DA_MEDICINA,
  novoServidorDaMedicina,
  REGRA_DA_MEDICINA,
} from '../support/cenario-da-medicina-por-edicao';
import { abrirAFase, entrarNoCronograma } from '../support/passo-das-decisoes';

/**
 * A Medicina usa uma alternativa por edição do ENEM: três alternativas, cada uma com a condição do
 * retorno do INEP daquela edição. A tela deixa montar as três sem sair do teclado e mostra a regra
 * em texto. O CI do frontend não sobe a API: o processo, os motivos e as gravações são servidos por
 * rota, e o corpo que a tela envia é o contrato de verdade entre as duas pontas.
 */

const alternativa = (page: Page, posicao: number): Locator =>
  page.getByRole('group', { name: `Alternativa ${posicao}`, exact: true });

async function incluirAAlternativaDaEdicao(page: Page, posicao: number, ano: string) {
  await page.getByRole('button', { name: 'Incluir alternativa' }).click();
  const grupo = alternativa(page, posicao);
  await grupo.getByLabel('Edição do exame').selectOption({ label: `ENEM ${ano}` });
  await grupo.getByLabel('Motivo desfavorável').selectOption({ label: DESCRICAO_DO_MOTIVO });
}

async function declararARegraComOResultado(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: 'Declarar a regra de homologação das inscrições' })
    .click();
  await page
    .getByLabel('Resultado que publica a lista de inscrições homologadas')
    .selectOption({ index: 1 });
}

test.describe('Regra de homologação das inscrições com uma alternativa por edição', () => {
  test('monta as três alternativas da Medicina e grava uma condição por edição', async ({
    page,
  }, testInfo) => {
    const servidor = novoServidorDaMedicina(null);
    await mockarServidorDaRegraDeHomologacao(page, servidor);
    await entrarNoCronograma(page, testInfo);
    await abrirAFase(page);
    await declararARegraComOResultado(page);

    for (const [indice, ano] of EDICOES_DA_MEDICINA.entries()) {
      await incluirAAlternativaDaEdicao(page, indice + 1, ano);
    }
    await page.getByRole('button', { name: /Gravar e avançar/ }).click();

    await expect.poll(() => servidor.cronogramasEnviados.length).toBeGreaterThan(0);
    const regra = servidor.cronogramasEnviados.at(-1)?.[0]
      ?.regraDeHomologacao as typeof REGRA_DA_MEDICINA;
    expect(regra.alternativas.map((a) => a.condicoes.map((c) => c.edicaoDoExame))).toEqual([
      [2024],
      [2025],
      [2026],
    ]);
    expect(
      regra.alternativas.flatMap((a) => a.condicoes.map((c) => c.motivoDesfavoravelCodigo)),
    ).toEqual(['SEM_RESULTADO_INEP', 'SEM_RESULTADO_INEP', 'SEM_RESULTADO_INEP']);
  });

  test('oferece só as edições que o processo declara e a regra em texto cita as três', async ({
    page,
  }, testInfo) => {
    await mockarServidorDaRegraDeHomologacao(page, novoServidorDaMedicina(REGRA_DA_MEDICINA));
    await entrarNoCronograma(page, testInfo);
    await abrirAFase(page);

    const opcoes = alternativa(page, 1).getByLabel('Edição do exame').getByRole('option');
    await expect(opcoes).toHaveText(['Selecione a edição…', 'ENEM 2024', 'ENEM 2025', 'ENEM 2026']);
    const texto = page.getByText('A regra em texto:');
    for (const ano of EDICOES_DA_MEDICINA) await expect(texto).toContainText(`ENEM ${ano}`);
  });

  test('grava sem mexer e a regra da Medicina segue igual, com o enquadramento de cada edição', async ({
    page,
  }, testInfo) => {
    const servidor = novoServidorDaMedicina(REGRA_DA_MEDICINA);
    await mockarServidorDaRegraDeHomologacao(page, servidor);
    await entrarNoCronograma(page, testInfo);

    await page.getByRole('button', { name: /Gravar e avançar/ }).click();

    await expect.poll(() => servidor.cronogramasEnviados.length).toBeGreaterThan(0);
    expect(servidor.cronogramasEnviados.at(-1)?.[0]?.regraDeHomologacao).toEqual(REGRA_DA_MEDICINA);
  });
});
