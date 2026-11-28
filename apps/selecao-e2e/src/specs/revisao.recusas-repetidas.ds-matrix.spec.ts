import { expect, test } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import { bancaDaFaseDoServidor, idDaBancaGravada } from '../fixtures/cronograma-do-servidor';
import { ID_DO_TIPO_HETEROIDENTIFICACAO, tipoDoCatalogo } from '../fixtures/tipos-de-banca';
import { novoServidorDasBancas } from '../support/api-das-bancas';
import { identificadoresDe } from '../support/medicoes-do-passo';
import {
  abrirOCronogramaDasBancas,
  bancaDaLista,
  daBancaDaFase,
  listaDaFase,
} from '../support/passo-das-bancas';
import { publicarPelaRevisao, simularOQuadroDeVagas } from '../support/publicacao-do-processo';

const HETEROIDENTIFICACAO = tipoDoCatalogo(ID_DO_TIPO_HETEROIDENTIFICACAO);
const CODIGO = 'uniplus.selecao.banca.tipo_exige_duas_ou_mais_bancas';
const MENSAGEM = 'O tipo Banca de heteroidentificação exige duas ou mais bancas.';

test.describe('Recusas repetidas da publicação na Revisão — matriz DS @ds', () => {
  test('duas recusas do mesmo código têm botões de nomes diferentes, sem violação de acessibilidade, e o segundo leva à sua banca', async ({
    page,
  }, testInfo) => {
    const bancas = [1, 2].map((ordem) =>
      bancaDaFaseDoServidor(HETEROIDENTIFICACAO, {
        id: idDaBancaGravada(ordem),
        posicaoNoTipo: ordem,
      }),
    );
    const servidor = novoServidorDasBancas({ bancasDaFase: bancas });
    servidor.recusaDaPublicacao = () =>
      [0, 1].map((posicao) => ({
        field: `fases[0].bancasRequeridas[${posicao}]`,
        code: CODIGO,
        message: MENSAGEM,
        identificadores: daBancaDaFase(servidor, idDaBancaGravada(posicao + 1)),
      }));
    await abrirOCronogramaDasBancas(page, testInfo, servidor);
    await simularOQuadroDeVagas(page, testInfo);
    await publicarPelaRevisao(page, testInfo);

    const botoes = page.getByRole('button', { name: /^Ir ao campo/ });
    await expect(botoes).toHaveCount(2);
    const nomes = await botoes.evaluateAll((itens) =>
      itens.map((item) => item.getAttribute('aria-label')),
    );
    expect(new Set(nomes).size).toBe(2);
    expect(nomes.join()).not.toContain(CODIGO);
    expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);

    await botoes.nth(1).click();

    const segunda = bancaDaLista(listaDaFase(page), 'Banca de heteroidentificação 2');
    await expect(segunda).toBeFocused();
  });
});
