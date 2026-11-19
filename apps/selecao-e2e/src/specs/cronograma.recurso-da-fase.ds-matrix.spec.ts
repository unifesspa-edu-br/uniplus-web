import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import { PROCESSO_ID } from '../fixtures/processo-da-revisao';
import { mockarCatalogos } from '../fixtures/catalogos-do-cronograma';
import { faseDoServidor } from '../fixtures/cronograma-do-servidor';
import { mockarProcesso, prepararARevisao } from '../support/api-da-revisao';
import { identificadoresDe, medirTransbordo } from '../support/medicoes-do-passo';
import { irAoPasso } from '../support/navega-passo';

/**
 * Regra de recurso da fase no Cronograma, em consulta: o que a fase declara (prazo, publicação de
 * que o prazo corre, procedimentos) é lido do servidor e mostrado em texto. A sugestão do
 * procedimento vem do servidor e só aparece onde ele a informou: duas fases com configurações
 * diferentes provam que a tela segue o dado, não o código do procedimento nem o da fase.
 */

const PRODUTO = {
  id: '01960000-0000-7000-0000-0000000009d1',
  atoCodigo: 'RESULTADO_PRELIMINAR',
  papel: 'PRELIMINAR',
};

const REGRA_DO_RECURSO = {
  codigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO',
  versao: '1.0',
  hash: 'hash-r1',
};

const PROCEDIMENTO_COM_SUGESTAO = {
  tipoDeDecisao: 'DEFERIMENTO',
  alvo: null,
  regra: { codigo: 'RECURSO-NOTA-RECALCULADA', versao: '1.0', hash: 'hash-p1' },
  sugestao: 'RECURSO-NOTA-RECALCULADA-PELA-BANCA',
};

const PROCEDIMENTO_SEM_SUGESTAO = {
  tipoDeDecisao: 'INDEFERIMENTO',
  alvo: null,
  regra: { codigo: 'RECURSO-MANTEM-NOTA', versao: '1.0', hash: 'hash-p2' },
  sugestao: null,
};

function faseComRecurso(procedimentos: readonly unknown[]) {
  return faseDoServidor({
    publicacoes: {
      produtos: [PRODUTO],
      produzResultado: true,
      regraRecurso: {
        id: '01960000-0000-7000-0000-0000000009c5',
        produtoAncoraId: PRODUTO.id,
        regra: REGRA_DO_RECURSO,
        parametros: {
          prazoValor: 2,
          prazoUnidade: 'diasUteis',
          suspensividadePrimeiraInstanciaValor: null,
          suspensividadePrimeiraInstanciaUnidade: null,
          admiteInstanciaSuperior: false,
          suspensividadeSegundaInstanciaValor: null,
          suspensividadeSegundaInstanciaUnidade: null,
        },
        procedimentos,
      },
    },
  } as Parameters<typeof faseDoServidor>[0]);
}

const titulo = (page: Page) =>
  page.getByText('Procedimentos declarados para este recurso', { exact: true });

async function abrirCronograma(
  page: Page,
  testInfo: TestInfo,
  procedimentos: readonly unknown[],
): Promise<void> {
  await prepararARevisao(page, testInfo.project.name);
  await mockarCatalogos(page);
  await mockarProcesso(page, {
    status: 'publicado',
    cronogramaFases: [faseComRecurso(procedimentos)],
  });
  await page.goto(`/processo-seletivo/${PROCESSO_ID}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await irAoPasso(page, 'Cronograma', testInfo);
}

test.describe('Cronograma — recurso da fase em consulta, matriz DS @ds', () => {
  test('mostra cada procedimento declarado e a sugestão só onde o servidor a informou', async ({
    page,
  }, testInfo) => {
    await abrirCronograma(page, testInfo, [PROCEDIMENTO_COM_SUGESTAO, PROCEDIMENTO_SEM_SUGESTAO]);

    await expect(titulo(page)).toBeVisible();
    const lista = page.getByRole('list', { name: 'Procedimentos declarados para este recurso' });
    await expect(lista.getByRole('listitem')).toHaveCount(2);
    await expect(lista.getByRole('listitem').first()).toContainText('DEFERIMENTO');
    await expect(lista.getByRole('listitem').first()).toContainText(
      'Sugestão: RECURSO-NOTA-RECALCULADA-PELA-BANCA',
    );
    await expect(lista.getByRole('listitem').nth(1)).toContainText('INDEFERIMENTO');
    await expect(lista.getByRole('listitem').nth(1)).not.toContainText('Sugestão');
  });

  test('sem procedimentos declarados, o bloco não aparece', async ({ page }, testInfo) => {
    await abrirCronograma(page, testInfo, []);

    await expect(page.getByText('Cabe recurso do que esta fase publica')).toBeVisible();
    await expect(titulo(page)).toHaveCount(0);
  });

  test('devolve o prazo declarado como foi gravado', async ({ page }, testInfo) => {
    await abrirCronograma(page, testInfo, [PROCEDIMENTO_SEM_SUGESTAO]);

    await expect(page.getByText('Prazo de interposição')).toBeVisible();
    await expect(page.getByText('2 dias úteis')).toBeVisible();
  });

  test('não viola WCAG 2.1 AA nem transborda com os procedimentos e a sugestão', async ({
    page,
  }, testInfo) => {
    await abrirCronograma(page, testInfo, [PROCEDIMENTO_COM_SUGESTAO, PROCEDIMENTO_SEM_SUGESTAO]);
    await expect(titulo(page)).toBeVisible();

    expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);
    const medida = await medirTransbordo(page);
    expect(medida.documento).toBeLessThanOrEqual(1);
    expect(medida.scroller).toBeLessThanOrEqual(1);
  });
});
