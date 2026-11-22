import { expect, test } from '@playwright/test';
import { etapaDoServidor } from '../fixtures/cronograma-do-servidor';
import { ID_DO_TIPO_IMPORTACAO_DAS_NOTAS } from '../fixtures/tipos-de-banca';
import { novoServidorDasBancas } from '../support/api-das-bancas';
import {
  abrirAEtapa,
  abrirAFase,
  abrirOCronogramaDasBancas,
  acrescentarBanca,
  bancaDaLista,
  conferirATela,
  daEtapa,
  gravarOCronograma,
  listaDaEtapa,
  vezesNaPagina,
} from '../support/passo-das-bancas';
import { publicarPelaRevisao, simularOQuadroDeVagas } from '../support/publicacao-do-processo';

/**
 * A etapa cuja nota vem do ENEM também tem a seção de bancas: a tela não a esconde nem recusa a
 * banca por conta própria, e a recusa da publicação, quando a API a faz, chega com o texto dela.
 *
 * O CI do frontend sobe Keycloak, mas não a API: o processo e as respostas são servidos por rota.
 */

const NOTA_DO_ENEM = etapaDoServidor({
  identificacao: {
    nome: 'Nota do ENEM',
    faseCodigo: 'COLETA_INSCRICAO',
    tipoEtapa: {
      origemId: '01960000-0000-7000-0000-0000000000b9',
      codigo: 'NOTA_DO_ENEM',
      nome: 'Nota do ENEM',
      notaDeOrigemNoEnem: true,
      exigeCorrecaoIndependente: false,
    },
  },
});

test.describe('Etapa da nota do ENEM com bancas — matriz DS @ds', () => {
  test('mostra a seção de bancas e grava a banca que a pessoa acrescentou', async ({
    page,
  }, testInfo) => {
    const servidor = novoServidorDasBancas({ etapa: NOTA_DO_ENEM });
    await abrirOCronogramaDasBancas(page, testInfo, servidor);
    await abrirAFase(page);
    await abrirAEtapa(page);
    const lista = listaDaEtapa(page);
    await expect(page.getByRole('heading', { name: 'Quem julga esta etapa' })).toBeVisible();
    await expect(page.getByText(/A nota desta etapa é calculada pelo sistema/)).toBeVisible();

    await acrescentarBanca(lista, 'Banca de importação das notas do INEP');

    await expect(bancaDaLista(lista, 'Banca de importação das notas do INEP 1')).toBeVisible();
    await expect(lista.getByRole('alert')).toHaveCount(0);
    await conferirATela(page, lista);

    await gravarOCronograma(page, servidor);
    expect(servidor.etapasEnviadas.at(-1)?.[0].bancas).toEqual([
      { id: null, tipoBancaId: ID_DO_TIPO_IMPORTACAO_DAS_NOTAS, regraDeDeliberacao: null },
    ]);
  });

  test('a recusa da publicação à banca da etapa de nota do ENEM mostra o texto da API', async ({
    page,
  }, testInfo) => {
    const codigo = 'uniplus.selecao.processo_seletivo.etapa_nota_enem_com_banca';
    const mensagem = 'A nota desta etapa vem do ENEM e não é lançada por banca de avaliação.';
    const servidor = novoServidorDasBancas({ etapa: NOTA_DO_ENEM });
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

    await page.getByRole('button', { name: `Ir ao campo da causa ${codigo}` }).click();

    const lista = listaDaEtapa(page);
    await expect(lista.getByText(mensagem)).toBeVisible();
    await expect(lista.locator('#cr-etapa-bancas-erro-0')).toBeFocused();
    expect(await vezesNaPagina(page, mensagem)).toBe(1);
    await conferirATela(page, lista);
  });
});
