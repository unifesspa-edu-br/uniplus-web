import { expect, test } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import { bancaDaFaseDoServidor, idDaBancaGravada } from '../fixtures/cronograma-do-servidor';
import { ID_DO_TIPO_HETEROIDENTIFICACAO, tipoDoCatalogo } from '../fixtures/tipos-de-banca';
import { novoServidorDasBancas } from '../support/api-das-bancas';
import { identificadoresDe } from '../support/medicoes-do-passo';
import { abrirAFase, abrirOCronogramaDasBancas } from '../support/passo-das-bancas';

const CODIGO = 'uniplus.selecao.configuracao_do_recurso_da_fase.prazo_em_fracao_de_dia_util';
const MENSAGEM = 'O prazo em dias úteis não admite fração de dia.';
const CAMPOS = ['fases[0].regraRecurso.prazoValor', 'fases[0].regraRecurso.prazoUnidade'];

test.describe('Recusas da regra de recurso da fase repetidas — matriz DS @ds', () => {
  test('duas recusas do mesmo código têm botões de nomes diferentes, a lista não viola WCAG A e AA e o segundo leva à sua unidade', async ({
    page,
  }, testInfo) => {
    const banca = bancaDaFaseDoServidor(tipoDoCatalogo(ID_DO_TIPO_HETEROIDENTIFICACAO), {
      id: idDaBancaGravada(1),
    });
    const servidor = novoServidorDasBancas({ bancasDaFase: [banca] });
    servidor.recusaDaGravacao.fases = CAMPOS.map((field) => ({
      field,
      code: CODIGO,
      message: MENSAGEM,
    }));
    await abrirOCronogramaDasBancas(page, testInfo, servidor);
    await abrirAFase(page);

    await page.getByRole('button', { name: /Gravar e avançar/ }).click();

    const botoes = page.getByRole('button', { name: /^Ir ao campo/ });
    await expect(botoes).toHaveCount(2);
    const nomes = await botoes.evaluateAll((itens) =>
      itens.map((item) => item.getAttribute('aria-label')),
    );
    expect(nomes).toEqual([
      `Ir ao campo da causa 1: ${MENSAGEM}`,
      `Ir ao campo da causa 2: ${MENSAGEM}`,
    ]);
    expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);

    await botoes.nth(1).click();

    const prazo = page.getByRole('group', { name: /Prazo de interposição/ });
    await expect(prazo.getByRole('combobox', { name: 'Unidade' })).toBeFocused();
  });
});
