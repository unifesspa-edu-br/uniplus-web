import { expect, test } from '@playwright/test';
import { CATEGORIAS_DE_DOCUMENTO } from '../fixtures/catalogos-do-cronograma';
import {
  bancaDaEtapaDoServidor,
  bancaDaFaseDoServidor,
  idDaBancaGravada,
} from '../fixtures/cronograma-do-servidor';
import {
  ID_DO_TIPO_ANALISE_DOCUMENTAL,
  ID_DO_TIPO_ENTREVISTA,
  ID_DO_TIPO_HETEROIDENTIFICACAO,
  tipoDoCatalogo,
} from '../fixtures/tipos-de-banca';
import { novoServidorDasBancas, type BancaDaFaseLida } from '../support/api-das-bancas';
import {
  abrirAEtapa,
  abrirAFase,
  abrirOCronogramaDasBancas,
  bancaDaLista,
  conferirATela,
  daBancaDaEtapa,
  daBancaDaFase,
  daEtapa,
  listaDaEtapa,
  listaDaFase,
  vezesNaPagina,
} from '../support/passo-das-bancas';
import { publicarPelaRevisao, simularOQuadroDeVagas } from '../support/publicacao-do-processo';
import { quorumDaVotacao, REGRA_COLEGIADA } from '../support/regra-da-banca';

/**
 * As recusas que a API devolve às bancas, de ponta a ponta na tela: na gravação, pela posição da
 * banca no que foi enviado; na publicação, pelo identificador que a API deu. A recusa aparece uma
 * vez só, junto do controle ou da banca que aponta; a de banca que saiu da tela vai ao bloco da
 * seção, com a nota que diz isso.
 *
 * O CI do frontend sobe Keycloak, mas não a API: as recusas são servidas por rota, com o texto que
 * a API devolveria. A tela não decide quantas bancas o tipo exige nem se a banca de recursos é
 * obrigatória: só mostra o que a API disse.
 */

const [RACA_E_ETNIA, RENDA] = CATEGORIAS_DE_DOCUMENTO;
const ENTREVISTA = tipoDoCatalogo(ID_DO_TIPO_ENTREVISTA);
const ANALISE_DOCUMENTAL = tipoDoCatalogo(ID_DO_TIPO_ANALISE_DOCUMENTAL);
const HETEROIDENTIFICACAO = tipoDoCatalogo(ID_DO_TIPO_HETEROIDENTIFICACAO);
const NOTA_DA_BANCA_AUSENTE = 'Sobre uma banca que não está mais nesta tela.';
const ID_DA_BANCA_QUE_SAIU = idDaBancaGravada(99);

const IR_AO_CAMPO = (codigo: string) => `Ir ao campo da causa ${codigo}`;

function entrevistasDaEtapa() {
  return [1, 2].map((ordem) =>
    bancaDaEtapaDoServidor(ENTREVISTA, {
      id: idDaBancaGravada(ordem),
      posicaoNoTipo: ordem,
      regraDeDeliberacao: REGRA_COLEGIADA,
    }),
  );
}

function analisesDaFase(): BancaDaFaseLida[] {
  const comCategoria = (ordem: number, categoria: (typeof CATEGORIAS_DE_DOCUMENTO)[number]) =>
    bancaDaFaseDoServidor(ANALISE_DOCUMENTAL, {
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
  return [comCategoria(1, RENDA), comCategoria(2, RACA_E_ETNIA)];
}

test.describe('Recusas da API às bancas — matriz DS @ds', () => {
  test('a recusa da gravação a uma banca da etapa fica no controle dela, uma vez só', async ({
    page,
  }, testInfo) => {
    const mensagem = 'O quórum não pode ser maior que o número de integrantes titulares.';
    const servidor = novoServidorDasBancas({ bancasDaEtapa: entrevistasDaEtapa() });
    servidor.recusaDaGravacao.etapas = [
      {
        field: 'etapas[0].bancas[1].regraDeDeliberacao.quorum',
        code: 'uniplus.selecao.banca.quorum_invalido',
        message: mensagem,
      },
    ];
    await abrirOCronogramaDasBancas(page, testInfo, servidor);
    await abrirAFase(page);
    await abrirAEtapa(page);
    const lista = listaDaEtapa(page);

    await page.getByRole('button', { name: /Gravar e avançar/ }).click();

    const segunda = bancaDaLista(lista, 'Banca de entrevista 2');
    await expect(quorumDaVotacao(segunda)).toBeFocused();
    await expect(quorumDaVotacao(segunda)).toHaveAttribute('aria-invalid', 'true');
    await expect(quorumDaVotacao(bancaDaLista(lista, 'Banca de entrevista 1'))).not.toHaveAttribute(
      'aria-invalid',
      'true',
    );
    const mensagens = segunda.locator('sel-recusas-do-campo').filter({ hasText: mensagem });
    await expect(mensagens).toBeVisible();
    const idDaMensagem = await mensagens.evaluate((elemento) => elemento.id);
    await expect(quorumDaVotacao(segunda)).toHaveAttribute(
      'aria-describedby',
      new RegExp(`(?:^|\\s)${idDaMensagem}(?:\\s|$)`),
    );
    expect(await vezesNaPagina(page, mensagem)).toBe(1);
    await conferirATela(page, lista);
  });

  test('a definição parcial dos candidatos atendidos é recusada na banca que não os definiu', async ({
    page,
  }, testInfo) => {
    const mensagem =
      'Bancas do mesmo tipo que atendem candidatos diferentes precisam ter todos os candidatos atendidos definidos.';
    const [primeira, segundaSemCandidatos] = analisesDaFase();
    const servidor = novoServidorDasBancas({
      bancasDaFase: [primeira, { ...segundaSemCandidatos, candidatosAtendidos: [] }],
    });
    servidor.recusaDaGravacao.fases = [
      {
        field: 'fases[0].bancasRequeridas[1].categoriasDocumentoIds',
        code: 'uniplus.selecao.banca.candidatos_atendidos_definicao_parcial',
        message: mensagem,
      },
    ];
    await abrirOCronogramaDasBancas(page, testInfo, servidor);
    await abrirAFase(page);
    const lista = listaDaFase(page);

    await page.getByRole('button', { name: /Gravar e avançar/ }).click();

    expect(
      servidor.fasesEnviadas
        .at(-1)?.[0]
        .bancasRequeridas.map((banca) => banca.categoriasDocumentoIds),
    ).toEqual([[RENDA.id], []]);
    const segunda = bancaDaLista(lista, 'Banca de análise documental 2');
    await expect(segunda.getByRole('group', { name: 'Candidatos atendidos' })).toBeFocused();
    await expect(segunda.getByText(mensagem)).toBeVisible();
    await expect(
      bancaDaLista(lista, 'Banca de análise documental 1').getByText(mensagem),
    ).toHaveCount(0);
    expect(await vezesNaPagina(page, mensagem)).toBe(1);
    await conferirATela(page, lista);
  });

  test('a recusa da gravação a uma banca que saiu da tela vai ao bloco da seção, com a nota', async ({
    page,
  }, testInfo) => {
    const mensagem = 'A banca não pode ser alterada porque já tem inscrições atribuídas.';
    const servidor = novoServidorDasBancas({ bancasDaFase: analisesDaFase() });
    servidor.recusaDaGravacao.fases = [
      {
        field: 'fases[0].bancasRequeridas[7]',
        code: 'uniplus.selecao.banca.com_atribuicao',
        message: mensagem,
      },
    ];
    await abrirOCronogramaDasBancas(page, testInfo, servidor);
    await abrirAFase(page);
    const lista = listaDaFase(page);

    await page.getByRole('button', { name: /Gravar e avançar/ }).click();

    await expect(lista.getByText(mensagem)).toBeVisible();
    await expect(lista.getByText(NOTA_DA_BANCA_AUSENTE)).toBeVisible();
    expect(await vezesNaPagina(page, mensagem)).toBe(1);
    await conferirATela(page, lista);
  });

  test('a recusa da publicação a uma banca da fase leva à banca, que recebe o foco', async ({
    page,
  }, testInfo) => {
    const codigo = 'uniplus.selecao.banca.tipo_exige_duas_ou_mais_bancas';
    const mensagem = 'O tipo Banca de heteroidentificação exige duas ou mais bancas.';
    const unica = bancaDaFaseDoServidor(HETEROIDENTIFICACAO, { id: idDaBancaGravada(1) });
    const servidor = novoServidorDasBancas({ bancasDaFase: [unica] });
    servidor.recusaDaPublicacao = () => [
      {
        field: 'fases[0].bancasRequeridas[0]',
        code: codigo,
        message: mensagem,
        identificadores: daBancaDaFase(servidor, idDaBancaGravada(1)),
      },
    ];
    await abrirOCronogramaDasBancas(page, testInfo, servidor);
    await simularOQuadroDeVagas(page, testInfo);
    await publicarPelaRevisao(page, testInfo);

    await page.getByRole('button', { name: IR_AO_CAMPO(codigo) }).click();

    const lista = listaDaFase(page);
    const banca = bancaDaLista(lista, 'Banca de heteroidentificação 1');
    await expect(banca).toBeFocused();
    await expect(banca.getByText(mensagem)).toBeVisible();
    expect(await vezesNaPagina(page, mensagem)).toBe(1);
    await conferirATela(page, lista);
  });

  test('a recusa da publicação a uma banca que saiu da tela vai ao bloco da seção, com a nota', async ({
    page,
  }, testInfo) => {
    const codigo = 'uniplus.selecao.banca.tipo_exige_duas_ou_mais_bancas';
    const mensagem = 'O tipo Banca de heteroidentificação exige duas ou mais bancas.';
    const unica = bancaDaFaseDoServidor(HETEROIDENTIFICACAO, { id: idDaBancaGravada(1) });
    const servidor = novoServidorDasBancas({ bancasDaFase: [unica] });
    servidor.recusaDaPublicacao = () => [
      {
        field: 'fases[0].bancasRequeridas[1]',
        code: codigo,
        message: mensagem,
        identificadores: daBancaDaFase(servidor, ID_DA_BANCA_QUE_SAIU),
      },
    ];
    await abrirOCronogramaDasBancas(page, testInfo, servidor);
    await simularOQuadroDeVagas(page, testInfo);
    await publicarPelaRevisao(page, testInfo);

    await page.getByRole('button', { name: IR_AO_CAMPO(codigo) }).click();

    const lista = listaDaFase(page);
    await expect(lista.getByText(mensagem)).toBeVisible();
    await expect(lista.getByText(NOTA_DA_BANCA_AUSENTE)).toBeVisible();
    expect(await vezesNaPagina(page, mensagem)).toBe(1);
    await conferirATela(page, lista);
  });

  test('a recusa da publicação à seção de bancas da etapa leva o foco ao bloco dela', async ({
    page,
  }, testInfo) => {
    const codigo = 'uniplus.selecao.banca.recurso_sem_banca_que_o_julgue';
    const mensagem = 'O recurso contra o gabarito precisa de uma banca de análise de recursos.';
    const servidor = novoServidorDasBancas({ bancasDaEtapa: [entrevistasDaEtapa()[0]] });
    servidor.recusaDaPublicacao = () => [
      {
        field: 'etapas[0].bancas',
        code: codigo,
        message: mensagem,
        identificadores: daEtapa(servidor),
      },
    ];
    await abrirOCronogramaDasBancas(page, testInfo, servidor);
    await simularOQuadroDeVagas(page, testInfo);
    await publicarPelaRevisao(page, testInfo);

    await page.getByRole('button', { name: IR_AO_CAMPO(codigo) }).click();

    const lista = listaDaEtapa(page);
    await expect(lista.locator('sel-recusas-do-campo').first()).toBeFocused();
    await expect(lista.getByText(mensagem)).toBeVisible();
    await expect(lista.getByText(NOTA_DA_BANCA_AUSENTE)).toHaveCount(0);
    expect(await vezesNaPagina(page, mensagem)).toBe(1);
    await conferirATela(page, lista);
  });

  test('a recusa da publicação a uma banca da etapa leva à banca, e só a ela', async ({
    page,
  }, testInfo) => {
    const codigo = 'uniplus.selecao.banca.regra_de_deliberacao_obrigatoria';
    const mensagem = 'Declare a regra de deliberação desta banca.';
    const servidor = novoServidorDasBancas({ bancasDaEtapa: entrevistasDaEtapa() });
    servidor.recusaDaPublicacao = () => [
      {
        field: 'etapas[0].bancas[0].regraDeDeliberacao',
        code: codigo,
        message: mensagem,
        identificadores: daBancaDaEtapa(servidor, idDaBancaGravada(2)),
      },
    ];
    await abrirOCronogramaDasBancas(page, testInfo, servidor);
    await simularOQuadroDeVagas(page, testInfo);
    await publicarPelaRevisao(page, testInfo);

    await page.getByRole('button', { name: IR_AO_CAMPO(codigo) }).click();

    const lista = listaDaEtapa(page);
    await expect(bancaDaLista(lista, 'Banca de entrevista 2').getByText(mensagem)).toBeVisible();
    await expect(bancaDaLista(lista, 'Banca de entrevista 1').getByText(mensagem)).toHaveCount(0);
    expect(await vezesNaPagina(page, mensagem)).toBe(1);
    await conferirATela(page, lista);
  });
});
