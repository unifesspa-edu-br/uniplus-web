import { expect, test } from '@playwright/test';
import {
  bancaDaEtapaDoServidor,
  bancaDaFaseDoServidor,
  idDaBancaGravada,
} from '../fixtures/cronograma-do-servidor';
import {
  comNomeEditadoNoCadastro,
  ID_DO_TIPO_ANALISE_DOCUMENTAL,
  ID_DO_TIPO_ENTREVISTA,
  TIPOS_DE_BANCA,
  tipoDoCatalogo,
} from '../fixtures/tipos-de-banca';
import { novoServidorDasBancas } from '../support/api-das-bancas';
import {
  abrirOCronogramaDasBancas,
  conferirAcessibilidadeDaTela,
} from '../support/passo-das-bancas';

/**
 * O processo publicado lê as bancas do que ficou congelado na publicação: o rótulo do tipo e a
 * posição da cópia. Mudar depois o nome do tipo no cadastro não muda o que a consulta mostra.
 *
 * O CI do frontend sobe Keycloak, mas não a API: o processo publicado e o cadastro, já alterado, são
 * servidos por rota. Em consulta a tela só lê: não há controle ao alcance do Tab, então a ordem do
 * foco não se aplica; o axe, o reflow e a unicidade dos identificadores valem.
 */

const ENTREVISTA = tipoDoCatalogo(ID_DO_TIPO_ENTREVISTA);
const ANALISE_DOCUMENTAL = tipoDoCatalogo(ID_DO_TIPO_ANALISE_DOCUMENTAL);
const NOME_NOVO_NO_CADASTRO = 'Entrevista da reitoria';

test.describe('Bancas do processo publicado — matriz DS @ds', () => {
  test('a etapa mostra o rótulo e a posição congelados, não o nome novo do cadastro', async ({
    page,
  }, testInfo) => {
    const servidor = novoServidorDasBancas({
      situacao: 'publicado',
      bancasDaEtapa: [1, 2].map((ordem) =>
        bancaDaEtapaDoServidor(ENTREVISTA, { id: idDaBancaGravada(ordem), posicaoNoTipo: ordem }),
      ),
      catalogo: comNomeEditadoNoCadastro(
        TIPOS_DE_BANCA,
        ID_DO_TIPO_ENTREVISTA,
        NOME_NOVO_NO_CADASTRO,
      ),
    });
    await abrirOCronogramaDasBancas(page, testInfo, servidor);
    const etapa = page.getByRole('group', { name: /^Etapa 1:/ });

    await expect(etapa.getByText(/^Banca de entrevista 1 — /)).toBeVisible();
    await expect(etapa.getByText(/^Banca de entrevista 2 — /)).toBeVisible();
    await expect(page.getByText(NOME_NOVO_NO_CADASTRO)).toHaveCount(0);
    await conferirAcessibilidadeDaTela(page);
  });

  test('a fase mostra o rótulo e a posição congelados, não o nome novo do cadastro', async ({
    page,
  }, testInfo) => {
    const servidor = novoServidorDasBancas({
      situacao: 'publicado',
      bancasDaFase: [1, 2].map((ordem) =>
        bancaDaFaseDoServidor(ANALISE_DOCUMENTAL, {
          id: idDaBancaGravada(ordem),
          posicaoNoTipo: ordem,
        }),
      ),
      catalogo: comNomeEditadoNoCadastro(
        TIPOS_DE_BANCA,
        ID_DO_TIPO_ANALISE_DOCUMENTAL,
        NOME_NOVO_NO_CADASTRO,
      ),
    });
    await abrirOCronogramaDasBancas(page, testInfo, servidor);

    await expect(page.getByText(/^Banca de análise documental 1 — /)).toBeVisible();
    await expect(page.getByText(/^Banca de análise documental 2 — /)).toBeVisible();
    await expect(page.getByText(NOME_NOVO_NO_CADASTRO)).toHaveCount(0);
    await conferirAcessibilidadeDaTela(page);
  });
});
