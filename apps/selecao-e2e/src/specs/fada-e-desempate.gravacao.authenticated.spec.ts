import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mockPermissoesEfetivas } from '@uniplus/shared-e2e';
import { BASE_LEGAL_DO_FADA_ID } from '../fixtures/catalogos-da-classificacao';
import {
  DETALHE_DESEMPATE_POR_AREA,
  DETALHE_PUBLICADO,
  PROCESSO_DESEMPATE_POR_AREA_ID,
  PROCESSO_PUBLICADO_ID,
} from '../fixtures/processo-classificado';
import { capturarFadaEDesempate } from '../support/api-do-fada-e-do-desempate';
import { abrirProcessoDoCenario } from '../support/consulta-da-classificacao';
import { isolarDaApi } from '../support/isolar-da-api';
import { irAoPasso } from '../support/navega-passo';
import { PERMISSOES_DO_LEANDRO } from '../support/permissoes';

/**
 * O Fator de Atenuação e o critério de desempate lidos do detalhe do processo na forma do contrato —
 * base legal congelada e parâmetros em sub-objetos — e devolvidos ao gravar: o comando leva só o
 * identificador da base legal e os parâmetros agrupados.
 *
 * O CI do frontend sobe Keycloak, mas não a API: o processo e os catálogos são servidos por rota,
 * e os `PUT` do Fator de Atenuação e do desempate são capturados para conferir o comando que a tela monta.
 */
const FADA_LIDA = DETALHE_PUBLICADO.fada;

/** O Fator de Atenuação sem o dado de elegibilidade, que o catálogo desta fixture não traz. */
const DETALHE_COM_FADA = {
  ...DETALHE_PUBLICADO,
  situacao: { codigo: 'RASCUNHO', rotulo: 'Rascunho' },
  fada: { ...FADA_LIDA, fatoElegibilidadeCodigo: null },
};

test.beforeEach(async ({ page }) => {
  await isolarDaApi(page);
  await mockPermissoesEfetivas(page, PERMISSOES_DO_LEANDRO);
});

async function abrirNoPasso(
  page: Page,
  testInfo: TestInfo,
  processo: { id: string; detalhe: unknown },
  passo: string,
) {
  await abrirProcessoDoCenario(page, testInfo, processo.id, processo.detalhe);
  const gravados = await capturarFadaEDesempate(page, processo.id);
  await irAoPasso(page, passo, testInfo);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(passo);
  return gravados;
}

/** O resumo que o passo mostra antes de gravar: o operador confirma, e só então sai a requisição. */
async function confirmarNoDialogo(page: Page, rotulo: string): Promise<void> {
  await page.getByRole('dialog').getByRole('button', { name: rotulo }).click();
}

test.describe('Fator de Atenuação e desempate — gravação na forma do contrato', () => {
  test('o Fator de Atenuação lido volta só com o identificador da base legal, sem os dados congelados', async ({
    page,
  }, testInfo) => {
    const gravados = await abrirNoPasso(
      page,
      testInfo,
      { id: PROCESSO_PUBLICADO_ID, detalhe: DETALHE_COM_FADA },
      'Fator de Atenuação',
    );
    await expect(page.getByLabel('Base legal do Fator de Atenuação')).toContainText(
      'Portaria Unifesspa nº 2514/2023',
    );

    await page.getByRole('button', { name: /Gravar e avançar/ }).click();
    await confirmarNoDialogo(page, 'Gravar o Fator de Atenuação');

    await expect.poll(() => gravados.fada.length).toBe(1);
    expect(gravados.fada[0]).toEqual({
      aplica: true,
      regra: { codigo: FADA_LIDA.regra.codigo, versao: FADA_LIDA.regra.versao },
      fator: FADA_LIDA.fator,
      teto: null,
      baseLegal: { id: BASE_LEGAL_DO_FADA_ID },
      fatoElegibilidadeCodigo: null,
    });
  });

  test('o desempate por áreas do ENEM volta com as áreas dentro dos parâmetros', async ({
    page,
  }, testInfo) => {
    const detalhe = {
      ...DETALHE_DESEMPATE_POR_AREA,
      situacao: { codigo: 'RASCUNHO', rotulo: 'Rascunho' },
    };
    const [criterioLido] = DETALHE_DESEMPATE_POR_AREA.criteriosDesempate;
    const gravados = await abrirNoPasso(
      page,
      testInfo,
      { id: PROCESSO_DESEMPATE_POR_AREA_ID, detalhe },
      'Desempate',
    );

    await page.getByRole('button', { name: /Gravar e avançar/ }).click();
    await confirmarNoDialogo(page, 'Gravar critérios');

    await expect.poll(() => gravados.desempates.length).toBe(1);
    const [enviado] = gravados.desempates[0];
    expect(enviado).toMatchObject({
      ordem: 1,
      regra: { codigo: criterioLido.regra.codigo, versao: criterioLido.regra.versao },
      parametros: { areas: criterioLido.parametros.areas },
    });
    expect(enviado).not.toHaveProperty('areas');
  });
});
