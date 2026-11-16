import { expect, test, type Page } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import type { AxeResults } from 'axe-core';
import { elementosForaDoCartao } from '../support/limites-do-cartao';
import { blocosColados } from '../support/ritmo-vertical';
import { medirTransbordoHorizontal } from '../support/rolagem-do-editor';
import { abrirVagas } from '../support/api-das-vagas';
import { larguraDoProjeto } from '../support/navega-passo';

/** Abaixo desta largura os cartões aninhados perdem o recuo de cada nível. */
const LARGURA_CARTAO_ANINHADO_ENXUTO = 480;

/**
 * Largura que os recuos de página e de cartões podem consumir, somados, na tela estreita:
 * em 375 px sobram pelo menos 260 px para o conteúdo do cartão mais interno.
 */
const RECUO_MAXIMO_NA_TELA_ESTREITA = 115;

/**
 * Matriz do Uni+ DS para o passo Vagas, com o quadro real do processo da Medicina 2027:
 * dez modalidades e a cascata de oito origens, o volume que a tela estreita tem de
 * acomodar. Roda em rascunho e em consulta, porque o processo publicado é o que a
 * comissão confere.
 *
 * O CI do frontend sobe Keycloak, mas não a API: o processo e os catálogos são servidos
 * por rota, e toda outra consulta de catálogo responde vazia.
 */
test.describe('Vagas — matriz DS @ds', () => {
  for (const status of ['rascunho', 'publicado'] as const) {
    test.describe(`processo em ${status}`, () => {
      test.beforeEach(async ({ page }, testInfo) => {
        await abrirVagas(page, testInfo, { status });
      });

      /**
       * A asserção é sobre a coleção inteira. `impact` é severidade do axe, não nível de
       * conformidade: filtrar por ele deixaria passar violação de WCAG 2.1 AA classificada
       * como moderada.
       */
      test('não viola WCAG 2.1 AA', async ({ page }) => {
        const resultado = await runAxeWcagAA(page);

        expect(identificadoresDe(resultado)).toEqual([]);
      });

      /**
       * Com a base legal e as garantias abertas: a garantia é fórmula sem espaço, e é o
       * texto que mais força a largura do cartão.
       */
      test('não transborda horizontalmente, nem com as garantias abertas', async ({ page }) => {
        await abrirGarantias(page);

        const transbordo = await medirTransbordoHorizontal(page);
        expect(transbordo.documento).toBeLessThanOrEqual(1);
        expect(transbordo.areaDeTrabalho).toBeLessThanOrEqual(1);
        expect(await elementosForaDoCartao(page)).toEqual([]);
      });

      test('separa título, alerta e dica do bloco vizinho', async ({ page }) => {
        expect(await blocosColados(page)).toEqual([]);
      });
    });
  }

  /**
   * Abaixo de 768 px a matriz e o quadro viram pilhas de cartões, que é onde estes defeitos
   * apareciam. Acima disso são tabelas, e as mesmas asserções valem para a linha da tabela.
   */
  test.describe('quadro e cascata', () => {
    test.beforeEach(async ({ page }, testInfo) => {
      await abrirVagas(page, testInfo);
    });

    /**
     * O código de modalidade é indivisível: "LB_/PCD" partido em duas linhas lê como dois
     * códigos. Um destino por linha também não serve, porque cada origem ocupava a tela.
     */
    test('mostra cada destino da cascata inteiro, vários por linha', async ({ page }) => {
      const cartoes = await page.locator('.cascata-matriz tbody tr').evaluateAll((linhas) =>
        linhas.map((linha) => {
          const destinos = Array.from(linha.querySelectorAll('td'));
          const partidos = destinos.filter((destino) => {
            const intervalo = document.createRange();
            intervalo.selectNodeContents(destino);
            const linhasDoTexto = new Set(
              Array.from(intervalo.getClientRects()).map((caixa) => Math.round(caixa.top)),
            );
            return linhasDoTexto.size > 1;
          });
          const linhasDeDestinos = new Set(
            destinos.map((destino) => Math.round(destino.getBoundingClientRect().top)),
          );
          return {
            origem: (linha.querySelector('th')?.textContent ?? '').trim(),
            partidos: partidos.map((destino) => (destino.textContent ?? '').trim()),
            destinos: destinos.length,
            linhas: linhasDeDestinos.size,
          };
        }),
      );

      expect(cartoes).toHaveLength(8);
      for (const cartao of cartoes) {
        expect(cartao.partidos, `destinos partidos em ${cartao.origem}`).toEqual([]);
        expect(cartao.linhas, `destinos de ${cartao.origem} um por linha`).toBeLessThan(
          cartao.destinos,
        );
      }
    });

    /** Os totais fecham a pilha de cartões das ofertas, com a mesma largura e o mesmo recuo. */
    test('alinha os totais aos cartões das ofertas', async ({ page }) => {
      const oferta = await page.locator('.vagas-table tbody tr').first().boundingBox();
      const totais = await page.locator('.vagas-table tfoot tr').boundingBox();
      const rotuloDaOferta = await page.locator('.vagas-table tbody td').first().boundingBox();
      const rotuloDosTotais = await page.locator('.vagas-table tfoot td').first().boundingBox();

      expect(oferta).not.toBeNull();
      expect(totais).not.toBeNull();
      expect(Math.abs((totais?.x ?? 0) - (oferta?.x ?? 0))).toBeLessThanOrEqual(1);
      expect(Math.abs((totais?.width ?? 0) - (oferta?.width ?? 0))).toBeLessThanOrEqual(1);
      expect(Math.abs((rotuloDosTotais?.x ?? 0) - (rotuloDaOferta?.x ?? 0))).toBeLessThanOrEqual(1);
    });

    /** Cartão dentro de cartão não pode deixar o conteúdo mais interno sem largura útil. */
    test('deixa largura útil ao cartão mais interno', async ({ page }, testInfo) => {
      const largura = larguraDoProjeto(testInfo);
      const util = await page
        .locator('.cascata-matriz tbody tr')
        .first()
        .evaluate((linha) => {
          const estilo = getComputedStyle(linha);
          return (
            linha.clientWidth - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight)
          );
        });

      // O recuo dos cartões aninhados só é enxugado na tela estreita.
      expect(
        largura >= LARGURA_CARTAO_ANINHADO_ENXUTO ||
          util >= largura - RECUO_MAXIMO_NA_TELA_ESTREITA,
        `largura útil de ${util} px em ${largura} px`,
      ).toBe(true);
    });
  });

  /**
   * Em consulta o passo lê o que o processo gravou e não espera pelos catálogos. Com eles em
   * falha, a leitura diz o que falta (nome da oferta, descrição da modalidade) e não oferece
   * nova tentativa: o botão e o alerta de erro são de quem edita.
   */
  test.describe('consulta com o catálogo em falha', () => {
    test.beforeEach(async ({ page }, testInfo) => {
      await abrirVagas(page, testInfo, { catalogos: 'falha' });
    });

    test('lê o gravado e diz o que não leu, sem controle de edição', async ({ page }) => {
      await expect(
        page
          .locator('.wiz-content')
          .getByText(/Os catálogos de ofertas, modalidades e regras não foram lidos/),
      ).toBeVisible();
      await expect(
        page.locator('.wiz-content').getByText('Oferta sem nome: catálogo não foi lido').first(),
      ).toBeVisible();
      await expect(page.locator('.wiz-content').getByText('Oferta fora do catálogo')).toHaveCount(
        0,
      );

      const controles = await page
        .locator('.wiz-content')
        .locator('input, select, textarea, button')
        .evaluateAll((elementos) =>
          elementos
            .filter((elemento) => elemento.checkVisibility())
            .map((elemento) => elemento.textContent?.trim() ?? elemento.tagName),
        );
      // Em consulta, a única ação é repetir a leitura que falhou; nada de edição.
      expect(controles).toEqual(['Tentar novamente']);
    });

    test('não viola WCAG 2.1 AA', async ({ page }) => {
      expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);
    });

    test('não transborda na horizontal e separa título, alerta e dica do bloco vizinho', async ({
      page,
    }) => {
      const transbordo = await medirTransbordoHorizontal(page);

      expect(transbordo.documento).toBeLessThanOrEqual(1);
      expect(transbordo.areaDeTrabalho).toBeLessThanOrEqual(1);
      expect(await blocosColados(page)).toEqual([]);
    });
  });
});

async function abrirGarantias(page: Page): Promise<void> {
  await page.locator('.wiz-content details').evaluateAll((detalhes) => {
    for (const detalhe of detalhes) {
      (detalhe as HTMLDetailsElement).open = true;
    }
  });
}

/** Falhar por id diz qual regra caiu; a coleção crua não. */
function identificadoresDe(resultado: AxeResults): string[] {
  return resultado.violations.map((violacao) => violacao.id);
}
