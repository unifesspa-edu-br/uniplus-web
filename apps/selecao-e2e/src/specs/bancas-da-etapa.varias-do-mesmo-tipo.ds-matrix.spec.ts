import { expect, test } from '@playwright/test';
import { bancaDaEtapaDoServidor, idDaBancaGravada } from '../fixtures/cronograma-do-servidor';
import {
  ID_DO_TIPO_ANALISE_DOCUMENTAL,
  ID_DO_TIPO_ENTREVISTA,
  ID_DO_TIPO_SEGUNDA_INSTANCIA,
  tipoDoCatalogo,
} from '../fixtures/tipos-de-banca';
import { novoServidorDasBancas, type BancaDaEtapaLida } from '../support/api-das-bancas';
import {
  abrirAEtapa,
  abrirAFase,
  abrirOCronogramaDasBancas,
  acrescentarBanca,
  anuncioDaLista,
  bancaDaLista,
  botaoDeMover,
  botaoDeRetirar,
  conferirATela,
  gravarOCronograma,
  listaDaEtapa,
  seletorDoTipo,
} from '../support/passo-das-bancas';

/**
 * Várias bancas do mesmo tipo na etapa, de ponta a ponta na tela: acrescentar, retirar, mover só
 * entre as do mesmo tipo e o que segue no comando de gravação.
 *
 * O CI do frontend sobe Keycloak, mas não a API: o processo e as gravações são servidos por rota.
 * O servidor simulado guarda o que a tela envia e o devolve por código do tipo e posição, como a
 * API, dando id à banca nova; a tela nunca envia a posição.
 */

const ENTREVISTA = tipoDoCatalogo(ID_DO_TIPO_ENTREVISTA);
const ANALISE_DOCUMENTAL = tipoDoCatalogo(ID_DO_TIPO_ANALISE_DOCUMENTAL);

function entrevistaGravada(ordem: number, posicao: number): BancaDaEtapaLida {
  return bancaDaEtapaDoServidor(ENTREVISTA, {
    id: idDaBancaGravada(ordem),
    posicaoNoTipo: posicao,
  });
}

test.describe('Várias bancas do mesmo tipo na etapa — matriz DS @ds', () => {
  test('duas bancas de entrevista são gravadas na ordem da lista, sem id e sem posição', async ({
    page,
  }, testInfo) => {
    const servidor = novoServidorDasBancas();
    await abrirOCronogramaDasBancas(page, testInfo, servidor);
    await abrirAFase(page);
    await abrirAEtapa(page);
    const lista = listaDaEtapa(page);

    await acrescentarBanca(lista, 'Banca de entrevista');
    await acrescentarBanca(lista, 'Banca de entrevista');

    await expect(bancaDaLista(lista, 'Banca de entrevista 1')).toBeVisible();
    await expect(bancaDaLista(lista, 'Banca de entrevista 2')).toBeVisible();
    await expect(anuncioDaLista(lista)).toHaveText('Banca de entrevista 2 acrescentada.');
    await conferirATela(page, lista);

    await gravarOCronograma(page, servidor);
    expect(servidor.etapasEnviadas.at(-1)?.[0].bancas).toEqual([
      { id: null, tipoBancaId: ID_DO_TIPO_ENTREVISTA, regraDeDeliberacao: null },
      { id: null, tipoBancaId: ID_DO_TIPO_ENTREVISTA, regraDeDeliberacao: null },
    ]);
  });

  test('três bancas do mesmo tipo: retirar a do meio renumera as seguintes e anuncia', async ({
    page,
  }, testInfo) => {
    const servidor = novoServidorDasBancas({
      bancasDaEtapa: [entrevistaGravada(1, 1), entrevistaGravada(2, 2), entrevistaGravada(3, 3)],
    });
    await abrirOCronogramaDasBancas(page, testInfo, servidor);
    await abrirAFase(page);
    await abrirAEtapa(page);
    const lista = listaDaEtapa(page);
    await expect(bancaDaLista(lista, 'Banca de entrevista 3')).toBeVisible();

    await botaoDeRetirar(lista, 'Banca de entrevista 2').click();

    await expect(bancaDaLista(lista, 'Banca de entrevista 3')).toHaveCount(0);
    await expect(bancaDaLista(lista, 'Banca de entrevista 2')).toBeVisible();
    await expect(anuncioDaLista(lista)).toHaveText(
      'Banca de entrevista 2 retirada; as seguintes deste tipo mudaram de número.',
    );
    await conferirATela(page, lista);

    await gravarOCronograma(page, servidor);
    expect(servidor.etapasEnviadas.at(-1)?.[0].bancas.map((banca) => banca.id)).toEqual([
      idDaBancaGravada(1),
      idDaBancaGravada(3),
    ]);
  });

  test('mover a segunda banca para a primeira posição troca o nome e mantém o id enviado', async ({
    page,
  }, testInfo) => {
    const servidor = novoServidorDasBancas({
      bancasDaEtapa: [entrevistaGravada(1, 1), entrevistaGravada(2, 2)],
    });
    await abrirOCronogramaDasBancas(page, testInfo, servidor);
    await abrirAFase(page);
    await abrirAEtapa(page);
    const lista = listaDaEtapa(page);
    await expect(
      lista.getByText(
        /A ordem das bancas do mesmo tipo é a ordem em que a API as considera para distribuir os recursos/,
      ),
    ).toBeVisible();

    const segunda = botaoDeMover(lista, 'Banca de entrevista 2', 'antes', 'Banca de entrevista 1');
    await segunda.click();

    await expect(anuncioDaLista(lista)).toHaveText(
      'A banca movida passou a ser a Banca de entrevista 1.',
    );
    await expect(bancaDaLista(lista, 'Banca de entrevista 1')).toBeFocused();
    await conferirATela(page, lista);

    await gravarOCronograma(page, servidor);
    expect(servidor.etapasEnviadas.at(-1)?.[0].bancas.map((banca) => banca.id)).toEqual([
      idDaBancaGravada(2),
      idDaBancaGravada(1),
    ]);
  });

  test('só troca de lugar com a banca do mesmo tipo', async ({ page }, testInfo) => {
    const servidor = novoServidorDasBancas({
      bancasDaEtapa: [
        bancaDaEtapaDoServidor(ANALISE_DOCUMENTAL, { id: idDaBancaGravada(1) }),
        entrevistaGravada(2, 1),
        entrevistaGravada(3, 2),
      ],
    });
    await abrirOCronogramaDasBancas(page, testInfo, servidor);
    await abrirAFase(page);
    await abrirAEtapa(page);
    const lista = listaDaEtapa(page);
    await expect(bancaDaLista(lista, 'Banca de análise documental 1')).toBeVisible();

    await expect(lista.getByRole('button', { name: /^Mover para (antes|depois): / })).toHaveCount(
      2,
    );
    await expect(
      bancaDaLista(lista, 'Banca de análise documental 1').getByRole('button', {
        name: /^Mover para (antes|depois): /,
      }),
    ).toHaveCount(0);
    await conferirATela(page, lista);
  });

  test('o tipo da banca de 2ª instância vem do catálogo e é indicado como qualquer outro', async ({
    page,
  }, testInfo) => {
    const servidor = novoServidorDasBancas();
    await abrirOCronogramaDasBancas(page, testInfo, servidor);
    await abrirAFase(page);
    await abrirAEtapa(page);
    const lista = listaDaEtapa(page);
    const rotulo = 'Banca de análise de recursos de 2ª instância';
    await expect(seletorDoTipo(lista).getByRole('option', { name: rotulo })).toHaveCount(1);

    await acrescentarBanca(lista, rotulo);

    await expect(bancaDaLista(lista, `${rotulo} 1`)).toBeVisible();
    await conferirATela(page, lista);
    await gravarOCronograma(page, servidor);
    expect(servidor.etapasEnviadas.at(-1)?.[0].bancas.map((banca) => banca.tipoBancaId)).toEqual([
      ID_DO_TIPO_SEGUNDA_INSTANCIA,
    ]);
  });
});
