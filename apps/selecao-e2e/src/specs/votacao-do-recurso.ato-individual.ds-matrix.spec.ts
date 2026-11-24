import type { ModoDeDeliberacao } from '@uniplus/shared-data/selecao';
import { expect, test } from '@playwright/test';
import { bancaDaFaseDoServidor, idDaBancaGravada } from '../fixtures/cronograma-do-servidor';
import {
  ID_DO_TIPO_ANALISE_DE_RECURSOS,
  ID_DO_TIPO_HOMOLOGACAO,
  tipoDoCatalogo,
} from '../fixtures/tipos-de-banca';
import { novoServidorDasBancas, type BancaDaFaseLida } from '../support/api-das-bancas';
import {
  abrirAFase,
  abrirOCronogramaDasBancas,
  acrescentarBanca,
  bancaDaLista,
  conferirATela,
  daBancaDaFase,
  gravarOCronograma,
  listaDaFase,
  reabrirOCronograma,
  vezesNaPagina,
} from '../support/passo-das-bancas';
import { publicarPelaRevisao, simularOQuadroDeVagas } from '../support/publicacao-do-processo';
import {
  criterioDaVotacao,
  declararAVotacao,
  declararOModo,
  REGRA_COLEGIADA,
  desempateDaVotacao,
  encerramentoDaVotacao,
  integrantesDaBanca,
  modoDaBanca,
  quorumDaVotacao,
  type RegraLida,
} from '../support/regra-da-banca';

/**
 * A banca de homologação das inscrições guarda duas regras na mesma banca: o ato individual que
 * homologa e a votação que ela usa quando julga recurso. Escolher uma não apaga a outra, e o que o
 * servidor guardou volta igual ao reabrir.
 *
 * O CI do frontend sobe Keycloak, mas não a API: o processo, as gravações e as recusas são
 * servidos por rota. A votação pela metade e a regra de votação exigida na publicação são recusas
 * da API; a tela só as mostra, junto do controle, com o texto que a API devolveu.
 */

const HOMOLOGACAO = tipoDoCatalogo(ID_DO_TIPO_HOMOLOGACAO);
const NOME_DA_BANCA = 'Banca de homologação das inscrições 1';
const ID_DA_BANCA = idDaBancaGravada(1);

const SO_O_ATO_INDIVIDUAL: RegraLida = {
  modo: { codigo: 'ATO_INDIVIDUAL' as ModoDeDeliberacao.ATO_INDIVIDUAL, rotulo: 'Ato individual' },
  integrantes: 1,
  suplentes: 0,
  quorum: null,
  criterio: null,
  desempate: null,
  encerramento: null,
  semUnanimidade: null,
};

const ATO_INDIVIDUAL_COM_VOTACAO: RegraLida = {
  ...SO_O_ATO_INDIVIDUAL,
  integrantes: 3,
  quorum: 2,
  criterio: REGRA_COLEGIADA.criterio,
  desempate: REGRA_COLEGIADA.desempate,
  encerramento: REGRA_COLEGIADA.encerramento,
};

const VOTACAO_ESCOLHIDA = {
  encerramento: 'A presidência encerra ao atingir o quórum',
  quorum: '2',
  criterio: 'Maioria simples',
  desempate: 'Voto da presidência',
};

function homologacaoGravada(regra: RegraLida | null): BancaDaFaseLida {
  return bancaDaFaseDoServidor(HOMOLOGACAO, { id: ID_DA_BANCA, regraDeDeliberacao: regra });
}

test.describe('Votação do recurso na banca de ato individual — matriz DS @ds', () => {
  test('grava o ato individual e a votação do recurso e os devolve iguais ao reabrir', async ({
    page,
  }, testInfo) => {
    const servidor = novoServidorDasBancas();
    await abrirOCronogramaDasBancas(page, testInfo, servidor);
    await abrirAFase(page);
    const lista = listaDaFase(page);
    await acrescentarBanca(lista, 'Banca de homologação das inscrições');
    const banca = bancaDaLista(lista, NOME_DA_BANCA);

    await declararOModo(banca, 'Ato individual', '3');
    await declararAVotacao(banca, VOTACAO_ESCOLHIDA);

    await conferirATela(page, lista);
    await gravarOCronograma(page, servidor);
    expect(servidor.fasesEnviadas.at(-1)?.[0].bancasRequeridas[0].regraDeDeliberacao).toEqual({
      modo: 'ATO_INDIVIDUAL',
      integrantes: 3,
      suplentes: 0,
      quorum: 2,
      criterio: 'MAIORIA_SIMPLES',
      desempate: 'VOTO_DA_PRESIDENCIA',
      encerramento: 'PRESIDENCIA_NO_QUORUM',
      semUnanimidade: null,
    });

    await reabrirOCronograma(page, testInfo);
    await abrirAFase(page);
    const reaberta = bancaDaLista(listaDaFase(page), NOME_DA_BANCA);
    await expect(modoDaBanca(reaberta)).toHaveValue('ATO_INDIVIDUAL');
    await expect(integrantesDaBanca(reaberta)).toHaveValue('3');
    await expect(encerramentoDaVotacao(reaberta)).toHaveValue('PRESIDENCIA_NO_QUORUM');
    await expect(quorumDaVotacao(reaberta)).toHaveValue('2');
    await expect(criterioDaVotacao(reaberta)).toHaveValue('MAIORIA_SIMPLES');
    await expect(desempateDaVotacao(reaberta)).toHaveValue('VOTO_DA_PRESIDENCIA');
  });

  test('escolher o ato individual de novo não apaga o critério nem o quórum do recurso', async ({
    page,
  }, testInfo) => {
    const servidor = novoServidorDasBancas({
      bancasDaFase: [homologacaoGravada(ATO_INDIVIDUAL_COM_VOTACAO)],
    });
    await abrirOCronogramaDasBancas(page, testInfo, servidor);
    await abrirAFase(page);
    const lista = listaDaFase(page);
    const banca = bancaDaLista(lista, NOME_DA_BANCA);

    await modoDaBanca(banca).selectOption({ label: 'Colegiada, com votação' });
    await modoDaBanca(banca).selectOption({ label: 'Ato individual' });

    await expect(criterioDaVotacao(banca)).toHaveValue('MAIORIA_SIMPLES');
    await expect(quorumDaVotacao(banca)).toHaveValue('2');
    await expect(encerramentoDaVotacao(banca)).toHaveValue('PRESIDENCIA_NO_QUORUM');
    await conferirATela(page, lista);

    await gravarOCronograma(page, servidor);
    expect(servidor.fasesEnviadas.at(-1)?.[0].bancasRequeridas[0]).toMatchObject({
      id: ID_DA_BANCA,
      regraDeDeliberacao: { modo: 'ATO_INDIVIDUAL', quorum: 2 },
    });
  });

  test('retirar a votação do recurso esvazia só a votação e mantém o ato individual', async ({
    page,
  }, testInfo) => {
    const servidor = novoServidorDasBancas({
      bancasDaFase: [homologacaoGravada(ATO_INDIVIDUAL_COM_VOTACAO)],
    });
    await abrirOCronogramaDasBancas(page, testInfo, servidor);
    await abrirAFase(page);
    const lista = listaDaFase(page);
    const banca = bancaDaLista(lista, NOME_DA_BANCA);

    await banca.getByRole('button', { name: 'Retirar a votação do recurso' }).click();

    await expect(modoDaBanca(banca)).toHaveValue('ATO_INDIVIDUAL');
    await expect(modoDaBanca(banca)).toBeFocused();
    await expect(banca.getByText('Votação do recurso retirada.')).toBeVisible();
    await conferirATela(page, lista);

    await gravarOCronograma(page, servidor);
    expect(servidor.fasesEnviadas.at(-1)?.[0].bancasRequeridas[0].regraDeDeliberacao).toEqual({
      ...SO_O_ATO_INDIVIDUAL,
      modo: 'ATO_INDIVIDUAL',
      integrantes: 3,
    });
  });

  test('a votação declarada pela metade é recusada ao salvar, junto do critério', async ({
    page,
  }, testInfo) => {
    const mensagem =
      'A votação do recurso foi declarada pela metade: informe também o critério e o encerramento.';
    const servidor = novoServidorDasBancas({
      bancasDaFase: [homologacaoGravada(SO_O_ATO_INDIVIDUAL)],
    });
    servidor.recusaDaGravacao.fases = [
      {
        field: 'fases[0].bancasRequeridas[0].regraDeDeliberacao.criterio',
        code: 'uniplus.selecao.banca.votacao_do_recurso_incompleta',
        message: mensagem,
      },
    ];
    await abrirOCronogramaDasBancas(page, testInfo, servidor);
    await abrirAFase(page);
    const lista = listaDaFase(page);
    const banca = bancaDaLista(lista, NOME_DA_BANCA);
    await quorumDaVotacao(banca).fill('1');

    await page.getByRole('button', { name: /Gravar e avançar/ }).click();

    await expect.poll(() => servidor.fasesEnviadas.length).toBeGreaterThan(0);
    await expect(criterioDaVotacao(banca)).toHaveAttribute('aria-invalid', 'true');
    await expect(criterioDaVotacao(banca)).toHaveAccessibleDescription(new RegExp(mensagem));
    expect(await vezesNaPagina(page, mensagem)).toBe(1);
    await conferirATela(page, lista);
  });

  test('sem banca dedicada, a publicação recusada pede a regra de votação do recurso', async ({
    page,
  }, testInfo) => {
    const mensagem = 'Declare a votação do recurso ou acrescente uma banca de análise de recursos.';
    const servidor = novoServidorDasBancas({
      bancasDaFase: [homologacaoGravada(SO_O_ATO_INDIVIDUAL)],
    });
    servidor.recusaDaPublicacao = () => [
      {
        field: 'fases[0].bancasRequeridas[0].regraDeDeliberacao',
        code: 'uniplus.selecao.banca.regra_de_deliberacao_obrigatoria',
        message: mensagem,
        identificadores: daBancaDaFase(servidor, ID_DA_BANCA),
      },
    ];
    await abrirOCronogramaDasBancas(page, testInfo, servidor);
    await simularOQuadroDeVagas(page, testInfo);
    await publicarPelaRevisao(page, testInfo);

    await page
      .getByRole('button', {
        name: 'Ir ao campo da causa uniplus.selecao.banca.regra_de_deliberacao_obrigatoria',
      })
      .click();

    const banca = bancaDaLista(listaDaFase(page), NOME_DA_BANCA);
    await expect(modoDaBanca(banca)).toHaveAccessibleDescription(new RegExp(mensagem));
    expect(await vezesNaPagina(page, mensagem)).toBe(1);
    expect(servidor.situacao).toBe('rascunho');
  });

  test('com banca dedicada de votação completa, a publicação é aceita sem a regra na homologação', async ({
    page,
  }, testInfo) => {
    const dedicada = bancaDaFaseDoServidor(tipoDoCatalogo(ID_DO_TIPO_ANALISE_DE_RECURSOS), {
      id: idDaBancaGravada(2),
      regraDeDeliberacao: {
        ...ATO_INDIVIDUAL_COM_VOTACAO,
        modo: REGRA_COLEGIADA.modo,
      },
    });
    const servidor = novoServidorDasBancas({
      bancasDaFase: [dedicada, homologacaoGravada(SO_O_ATO_INDIVIDUAL)],
    });
    servidor.recusaDaPublicacao = () => {
      const banca = servidor.fase.bancasRequeridas.find(
        (item) => item.tipoBancaOrigemId === ID_DO_TIPO_ANALISE_DE_RECURSOS,
      );
      const regra = banca?.regraDeDeliberacao;
      return regra?.modo.codigo === 'COLEGIADA_COM_VOTACAO' &&
        regra.integrantes &&
        regra.quorum &&
        regra.criterio &&
        regra.desempate &&
        regra.encerramento
        ? []
        : [
            {
              code: 'votacao_incompleta',
              message: 'Declare a votação completa da banca de recursos.',
            },
          ];
    };
    await abrirOCronogramaDasBancas(page, testInfo, servidor);
    await simularOQuadroDeVagas(page, testInfo);

    await publicarPelaRevisao(page, testInfo);

    await expect.poll(() => servidor.situacao).toBe('publicado');
  });
});
