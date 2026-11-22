import { expect, test } from '@playwright/test';
import { CATEGORIAS_DE_DOCUMENTO } from '../fixtures/catalogos-do-cronograma';
import { bancaDaFaseDoServidor, idDaBancaGravada } from '../fixtures/cronograma-do-servidor';
import {
  ID_DO_TIPO_ANALISE_DE_RECURSOS,
  ID_DO_TIPO_ANALISE_DOCUMENTAL,
  ID_DO_TIPO_HETEROIDENTIFICACAO,
  ID_DO_TIPO_SEGUNDA_INSTANCIA,
  tipoDoCatalogo,
} from '../fixtures/tipos-de-banca';
import { novoServidorDasBancas, type BancaDaFaseLida } from '../support/api-das-bancas';
import { marcar } from '../support/passo-das-decisoes';
import {
  abrirAFase,
  abrirOCronogramaDasBancas,
  acrescentarBanca,
  bancaDaLista,
  botaoDeMover,
  conferirATela,
  gravarOCronograma,
  listaDaFase,
  seletorDoTipo,
} from '../support/passo-das-bancas';

/**
 * Várias bancas do mesmo tipo na fase, de ponta a ponta na tela: as que atendem os mesmos
 * candidatos julgam em paralelo, as que atendem candidatos diferentes dividem as categorias, e cada
 * banca mantém os candidatos atendidos ao ser movida.
 *
 * O servidor simulado guarda o que a tela envia e o devolve por código do tipo e posição, como a
 * API; a tela não confere quantas bancas o tipo exige, quem recusa é a API na publicação.
 */

const [RACA_E_ETNIA, RENDA] = CATEGORIAS_DE_DOCUMENTO;
const ANALISE_DOCUMENTAL = tipoDoCatalogo(ID_DO_TIPO_ANALISE_DOCUMENTAL);
const PARALELAS = /julgam em paralelo e dividem os candidatos/;
const CATEGORIAS_DIFERENTES = /Bancas com categorias diferentes dividem as categorias/;

function analiseGravada(
  ordem: number,
  categoria: (typeof CATEGORIAS_DE_DOCUMENTO)[number],
): BancaDaFaseLida {
  return bancaDaFaseDoServidor(ANALISE_DOCUMENTAL, {
    id: idDaBancaGravada(ordem),
    posicaoNoTipo: ordem,
    candidatosAtendidos: [
      {
        id: idDaBancaGravada(ordem + 10),
        categoriaDocumentoOrigemId: categoria.id,
        codigo: categoria.codigo,
      },
    ],
  });
}

const novaBanca = (tipoBancaId: string, categoriasDocumentoIds: string[]) => ({
  id: null,
  tipoBancaId,
  categoriasDocumentoIds,
  regraDeDeliberacao: null,
});

test.describe('Várias bancas do mesmo tipo na fase — matriz DS @ds', () => {
  test('duas bancas que atendem os mesmos candidatos julgam em paralelo', async ({
    page,
  }, testInfo) => {
    const servidor = novoServidorDasBancas();
    await abrirOCronogramaDasBancas(page, testInfo, servidor);
    await abrirAFase(page);
    const lista = listaDaFase(page);

    await acrescentarBanca(lista, 'Banca de análise documental');
    await acrescentarBanca(lista, 'Banca de análise documental');
    await marcar(bancaDaLista(lista, 'Banca de análise documental 1'), RENDA.nome);
    await marcar(bancaDaLista(lista, 'Banca de análise documental 2'), RENDA.nome);

    await expect(lista.getByText(PARALELAS)).toHaveCount(1);
    await conferirATela(page, lista);

    await gravarOCronograma(page, servidor);
    expect(servidor.fasesEnviadas.at(-1)?.[0].bancasRequeridas).toEqual([
      novaBanca(ID_DO_TIPO_ANALISE_DOCUMENTAL, [RENDA.id]),
      novaBanca(ID_DO_TIPO_ANALISE_DOCUMENTAL, [RENDA.id]),
    ]);
  });

  test('bancas que atendem candidatos diferentes dividem as categorias e cada uma guarda as suas', async ({
    page,
  }, testInfo) => {
    const servidor = novoServidorDasBancas();
    await abrirOCronogramaDasBancas(page, testInfo, servidor);
    await abrirAFase(page);
    const lista = listaDaFase(page);

    await acrescentarBanca(lista, 'Banca de análise documental');
    await acrescentarBanca(lista, 'Banca de análise documental');
    await marcar(bancaDaLista(lista, 'Banca de análise documental 1'), RENDA.nome);
    await marcar(bancaDaLista(lista, 'Banca de análise documental 2'), RACA_E_ETNIA.nome);

    await expect(lista.getByText(CATEGORIAS_DIFERENTES)).toHaveCount(1);
    await conferirATela(page, lista);

    await gravarOCronograma(page, servidor);
    expect(servidor.fasesEnviadas.at(-1)?.[0].bancasRequeridas).toEqual([
      novaBanca(ID_DO_TIPO_ANALISE_DOCUMENTAL, [RENDA.id]),
      novaBanca(ID_DO_TIPO_ANALISE_DOCUMENTAL, [RACA_E_ETNIA.id]),
    ]);
  });

  test('mover uma banca leva junto os candidatos atendidos e mantém o id enviado', async ({
    page,
  }, testInfo) => {
    const servidor = novoServidorDasBancas({
      bancasDaFase: [analiseGravada(1, RENDA), analiseGravada(2, RACA_E_ETNIA)],
    });
    await abrirOCronogramaDasBancas(page, testInfo, servidor);
    await abrirAFase(page);
    const lista = listaDaFase(page);
    const segunda = bancaDaLista(lista, 'Banca de análise documental 2');
    await expect(segunda.getByLabel(RACA_E_ETNIA.nome)).toBeChecked();

    const mover = botaoDeMover(
      lista,
      'Banca de análise documental 2',
      'antes',
      'Banca de análise documental 1',
    );
    await mover.click();

    const primeira = bancaDaLista(lista, 'Banca de análise documental 1');
    await expect(primeira.getByLabel(RACA_E_ETNIA.nome)).toBeChecked();
    await conferirATela(page, lista);

    await gravarOCronograma(page, servidor);
    expect(servidor.fasesEnviadas.at(-1)?.[0].bancasRequeridas).toEqual([
      { ...novaBanca(ID_DO_TIPO_ANALISE_DOCUMENTAL, [RACA_E_ETNIA.id]), id: idDaBancaGravada(2) },
      { ...novaBanca(ID_DO_TIPO_ANALISE_DOCUMENTAL, [RENDA.id]), id: idDaBancaGravada(1) },
    ]);
  });

  test('duas bancas de análise de recursos mostram a orientação e são gravadas', async ({
    page,
  }, testInfo) => {
    const servidor = novoServidorDasBancas();
    await abrirOCronogramaDasBancas(page, testInfo, servidor);
    await abrirAFase(page);
    const lista = listaDaFase(page);

    await acrescentarBanca(lista, 'Banca de análise de recursos');
    await acrescentarBanca(lista, 'Banca de análise de recursos');

    await expect(bancaDaLista(lista, 'Banca de análise de recursos 1')).toBeVisible();
    await expect(bancaDaLista(lista, 'Banca de análise de recursos 2')).toBeVisible();
    await expect(
      lista.getByText('Os recursos se dividem de forma equilibrada entre estas bancas'),
    ).toBeVisible();
    await conferirATela(page, lista);

    await gravarOCronograma(page, servidor);
    expect(servidor.fasesEnviadas.at(-1)?.[0].bancasRequeridas.map((b) => b.tipoBancaId)).toEqual([
      ID_DO_TIPO_ANALISE_DE_RECURSOS,
      ID_DO_TIPO_ANALISE_DE_RECURSOS,
    ]);
  });

  test('o tipo com marcas mostra os avisos e a tela não recusa a banca única', async ({
    page,
  }, testInfo) => {
    const servidor = novoServidorDasBancas();
    await abrirOCronogramaDasBancas(page, testInfo, servidor);
    await abrirAFase(page);
    const lista = listaDaFase(page);

    await acrescentarBanca(lista, 'Banca de heteroidentificação');

    const banca = bancaDaLista(lista, 'Banca de heteroidentificação 1');
    await expect(
      banca.getByText(
        'Este tipo exige duas ou mais bancas para cada grupo de candidatos atendidos.',
      ),
    ).toBeVisible();
    await expect(banca.getByText('O recurso deste tipo se encerra na 1ª instância.')).toBeVisible();
    await expect(lista.getByRole('alert')).toHaveCount(0);
    await conferirATela(page, lista);

    await gravarOCronograma(page, servidor);
    expect(servidor.fasesEnviadas.at(-1)?.[0].bancasRequeridas).toEqual([
      novaBanca(ID_DO_TIPO_HETEROIDENTIFICACAO, []),
    ]);
  });

  test('o tipo da banca de 2ª instância vem do catálogo e é indicado como qualquer outro', async ({
    page,
  }, testInfo) => {
    const servidor = novoServidorDasBancas();
    await abrirOCronogramaDasBancas(page, testInfo, servidor);
    await abrirAFase(page);
    const lista = listaDaFase(page);
    const rotulo = 'Banca de análise de recursos de 2ª instância';
    await expect(seletorDoTipo(lista).getByRole('option', { name: rotulo })).toHaveCount(1);

    await acrescentarBanca(lista, rotulo);

    await expect(bancaDaLista(lista, `${rotulo} 1`)).toBeVisible();
    await conferirATela(page, lista);
    await gravarOCronograma(page, servidor);
    expect(servidor.fasesEnviadas.at(-1)?.[0].bancasRequeridas).toEqual([
      novaBanca(ID_DO_TIPO_SEGUNDA_INSTANCIA, []),
    ]);
  });
});
