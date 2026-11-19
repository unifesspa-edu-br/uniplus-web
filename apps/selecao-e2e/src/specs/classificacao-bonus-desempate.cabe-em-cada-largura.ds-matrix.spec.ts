import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mockPermissoesEfetivas, runAxeWcagAA } from '@uniplus/shared-e2e';
import { RESOLUCAO_PESO_AREA } from '../fixtures/catalogos-da-classificacao';
import {
  DETALHE_DESEMPATE_POR_AREA,
  PROCESSO_DESEMPATE_POR_AREA_ID,
} from '../fixtures/processo-classificado';
import {
  abrirProcessoDoCenario,
  abrirProcessoNovo,
  alturaDoProject,
  controlesVisiveis,
  declararFormulaLocal,
  esperarLayoutEstavel,
  LARGURAS_DE_REFERENCIA,
  valorEmConsulta,
} from '../support/consulta-da-classificacao';
import { identificadoresDe } from '../support/medicoes-do-passo';
import { irAoPasso } from '../support/navega-passo';
import { isolarDaApi } from '../support/isolar-da-api';
import { PERMISSOES_DO_LEANDRO } from '../support/permissoes';
import { medirTransbordoHorizontal } from '../support/rolagem-do-editor';

test.beforeEach(async ({ page }) => {
  await isolarDaApi(page);
  await mockPermissoesEfetivas(page, PERMISSOES_DO_LEANDRO);
});

/** A partir desta largura, o seletor mostra o código da regra inteiro. */
const LARGURA_CODIGO_INTEIRO = 768;

/** Com a lista até esta largura (40rem), o cartão do critério empilha número, campos e ações. */
const LARGURA_LISTA_EMPILHADA = 640;

test.describe('Classificação, bônus e desempate — matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await abrirProcessoNovo(page, testInfo);
  });

  test.describe('Fórmula e precisão', () => {
    test('o quadro de pesos cabe em cada largura, sem partir cabeçalho nem valor', async ({
      page,
    }, testInfo) => {
      await irAoPasso(page, 'Fórmula e precisão', testInfo);
      await declararFormulaLocal(page);
      await page.getByLabel('Classificação baseada em provas').check();
      await page
        .getByLabel('Resolução de Peso por Área', { exact: true })
        .selectOption(RESOLUCAO_PESO_AREA);
      await expect(page.getByRole('table', { name: /Prévia do quadro de pesos/ })).toBeVisible();
      // A base legal é a mesma nos quatro grupos: uma vez acima do quadro, e não em coluna.
      await expect(page.getByText(`Base legal: ${RESOLUCAO_PESO_AREA} – Anexo I`)).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Base legal' })).toHaveCount(0);

      for (const largura of LARGURAS_DE_REFERENCIA) {
        await quadroCabeNaLargura(page, testInfo, largura);
      }
    });
  });
});

/**
 * Cartão do critério de desempate por área (web#900): o nome da área não quebra letra a letra,
 * no celular os campos descem para a largura inteira do cartão e, lado a lado, número, campos e
 * ações começam no topo. Em rascunho, o seletor da regra tem a largura da lista de áreas; em
 * consulta, a regra e as áreas são lidas como texto (web#905).
 */
test.describe('Desempate por área — matriz DS @ds', () => {
  test.describe('processo em rascunho', () => {
    test.beforeEach(async ({ page }, testInfo) => {
      await abrirDesempatePorArea(page, testInfo, 'rascunho');
    });

    test('o cartão do critério cabe em cada largura sem quebrar as áreas', async ({
      page,
    }, testInfo) => {
      await expect(page.locator('.desempate-area__nome').first()).toBeVisible();
      expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);

      for (const largura of LARGURAS_DE_REFERENCIA) {
        const cartao = await cartaoNaLargura(page, testInfo, largura, '.desempate-area__nome');
        expect(cartao.larguraDoSeletor, `seletor e áreas em ${largura} px`).toBeGreaterThanOrEqual(
          cartao.larguraDaLista - 1,
        );
        // Um <select> não quebra linha: no celular o código não cabe e o seletor ocupa a largura
        // toda; a partir de 768 px o código tem de aparecer inteiro.
        expect(
          cartao.codigoCabeNoSeletor || largura < LARGURA_CODIGO_INTEIRO,
          `código da regra inteiro em ${largura} px`,
        ).toBe(true);
      }
    });
  });

  test.describe('processo publicado', () => {
    test.beforeEach(async ({ page }, testInfo) => {
      await abrirDesempatePorArea(page, testInfo, 'publicado');
    });

    test('lê a regra e a ordem das áreas como texto, e o cartão cabe em cada largura', async ({
      page,
    }, testInfo) => {
      // A ordem é a de avaliação: lista numerada, que o leitor de tela anuncia como tal.
      await expect(
        valorEmConsulta(page, 'Ordem das áreas do ENEM').locator('ol > li').first(),
      ).toHaveText('Redação');
      expect(await controlesVisiveis(page)).toEqual([]);
      expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);

      for (const largura of LARGURAS_DE_REFERENCIA) {
        await cartaoNaLargura(page, testInfo, largura, '.valor-em-consulta li');
      }
    });
  });
});

/**
 * A Fórmula de um processo publicado classificado pelo ENEM: a resolução é lida como texto, e o
 * quadro congelado no processo continua cabendo em cada largura (web#903, web#905).
 */
test.describe('Fórmula com quadro de pesos em consulta — matriz DS @ds', () => {
  test('lê a resolução como texto, e o quadro congelado cabe em cada largura', async ({
    page,
  }, testInfo) => {
    await abrirProcessoDoCenario(
      page,
      testInfo,
      PROCESSO_DESEMPATE_POR_AREA_ID,
      DETALHE_DESEMPATE_POR_AREA,
    );
    await irAoPasso(page, 'Fórmula e precisão', testInfo);

    await expect(valorEmConsulta(page, 'Resolução de Peso por Área')).toHaveText(
      RESOLUCAO_PESO_AREA,
    );
    await expect(page.getByRole('table', { name: /congelado no processo/ })).toBeVisible();
    expect(await controlesVisiveis(page)).toEqual([]);

    for (const largura of LARGURAS_DE_REFERENCIA) {
      await quadroCabeNaLargura(page, testInfo, largura);
    }
  });
});

/**
 * O processo classificado pelo ENEM com um critério de desempate por área, aberto no passo
 * Desempate.
 */
async function abrirDesempatePorArea(
  page: Page,
  testInfo: TestInfo,
  status: 'rascunho' | 'publicado',
): Promise<void> {
  await abrirProcessoDoCenario(page, testInfo, PROCESSO_DESEMPATE_POR_AREA_ID, {
    ...DETALHE_DESEMPATE_POR_AREA,
    status,
  });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await irAoPasso(page, 'Desempate', testInfo);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Desempate');
}

/**
 * Leva a tela à largura e confere o que vale para o cartão em edição e em consulta: sem
 * transbordo, nome da área inteiro, campos empilhados só na lista estreita e, lado a lado, tudo
 * alinhado ao topo. Devolve as medidas para as conferências próprias de cada modo.
 */
async function cartaoNaLargura(
  page: Page,
  testInfo: TestInfo,
  largura: number,
  nomeDaArea: string,
): Promise<Awaited<ReturnType<typeof medidasDoCartao>>> {
  await page.setViewportSize({ width: largura, height: alturaDoProject(testInfo) });
  await esperarLayoutEstavel(page);
  const cartao = await medidasDoCartao(page);
  const empilhado = cartao.larguraDaListaDeCriterios <= LARGURA_LISTA_EMPILHADA;

  const medida = await medirTransbordoHorizontal(page);
  expect(medida.documento, `documento em ${largura} px`).toBeLessThanOrEqual(1);
  expect(medida.areaDeTrabalho, `área de trabalho em ${largura} px`).toBeLessThanOrEqual(1);
  // Uma letra por linha: a palavra se partia em várias linhas do nome.
  expect(
    await trechosPartidos(page, `.desempate-item ${nomeDaArea}`, '\\S+'),
    `nome da área em ${largura} px`,
  ).toEqual([]);
  expect(cartao.camposAbaixoDoNumero, `campos empilhados em ${largura} px`).toBe(empilhado);
  expect(
    empilhado || cartao.desalinhamentoNoTopo <= 1,
    `número, campos e ações no topo em ${largura} px (${cartao.desalinhamentoNoTopo} px)`,
  ).toBe(true);
  return cartao;
}

/**
 * O quadro de pesos na largura (web#903): sem transbordo da página nem do próprio quadro, sem
 * cabeçalho partido, "Peso X" numa linha só e sem violar WCAG 2.1 AA.
 */
async function quadroCabeNaLargura(page: Page, testInfo: TestInfo, largura: number): Promise<void> {
  await page.setViewportSize({ width: largura, height: alturaDoProject(testInfo) });
  await esperarLayoutEstavel(page);

  const medida = await medirTransbordoHorizontal(page);
  expect(medida.documento, `documento em ${largura} px`).toBeLessThanOrEqual(1);
  expect(medida.areaDeTrabalho, `área de trabalho em ${largura} px`).toBeLessThanOrEqual(1);
  expect(await rolagemDoQuadro(page), `rolagem do quadro em ${largura} px`).toBe(0);
  expect(
    await trechosPartidos(page, '.peso-area__quadro th', '\\S+'),
    `cabeçalhos em ${largura} px`,
  ).toEqual([]);
  // "Peso 1,5" é um valor só: o número não desce para a linha de baixo.
  expect(
    await trechosPartidos(page, '.peso-area__valor', 'Peso \\S+'),
    `valores em ${largura} px`,
  ).toEqual([]);
  expect(identificadoresDe(await runAxeWcagAA(page)), `WCAG em ${largura} px`).toEqual([]);
}

/** Quanto a tabela de pesos passa da largura do próprio quadro. */
async function rolagemDoQuadro(page: Page): Promise<number> {
  return page.evaluate(() => {
    const quadro = document.querySelector('.peso-area__quadro');
    return quadro instanceof HTMLElement ? Math.max(0, quadro.scrollWidth - quadro.clientWidth) : 0;
  });
}

/**
 * Os trechos (casados por `padrao`) que o navegador partiu em mais de uma linha, no texto dos
 * elementos visíveis de `seletor`: um trecho partido tem mais de um retângulo de linha.
 */
async function trechosPartidos(page: Page, seletor: string, padrao: string): Promise<string[]> {
  return page.evaluate(
    ({ seletor, padrao }) =>
      Array.from(document.querySelectorAll(seletor)).flatMap((elemento) => {
        const percurso = document.createTreeWalker(elemento, NodeFilter.SHOW_TEXT);
        const textos: Text[] = [];
        while (percurso.nextNode()) textos.push(percurso.currentNode as Text);
        return textos.flatMap((texto) =>
          Array.from(texto.data.matchAll(new RegExp(padrao, 'g'))).flatMap((trecho) => {
            const intervalo = document.createRange();
            intervalo.setStart(texto, trecho.index);
            intervalo.setEnd(texto, trecho.index + trecho[0].length);
            const linhas = new Set(
              Array.from(intervalo.getClientRects(), (retangulo) => Math.round(retangulo.top)),
            );
            return linhas.size > 1 ? [trecho[0]] : [];
          }),
        );
      }),
    { seletor, padrao },
  );
}

interface MedidasDoCartao {
  larguraDoSeletor: number;
  larguraDaLista: number;
  larguraDaListaDeCriterios: number;
  codigoCabeNoSeletor: boolean;
  camposAbaixoDoNumero: boolean;
  desalinhamentoNoTopo: number;
}

/** As medidas do primeiro cartão de critério que os critérios de aceite comparam. */
async function medidasDoCartao(page: Page): Promise<MedidasDoCartao> {
  return {
    ...(await largurasDoCartao(page)),
    codigoCabeNoSeletor: await codigoCabeNoSeletor(page),
    ...(await alinhamentoDoCartao(page)),
  };
}

async function largurasDoCartao(
  page: Page,
): Promise<
  Pick<MedidasDoCartao, 'larguraDoSeletor' | 'larguraDaLista' | 'larguraDaListaDeCriterios'>
> {
  return page.evaluate(() => {
    const cartao = document.querySelector('.desempate-item');
    const largura = (seletor: string) =>
      cartao?.querySelector(seletor)?.getBoundingClientRect().width ?? 0;
    return {
      larguraDoSeletor: largura('select'),
      larguraDaLista: largura('.desempate-areas'),
      larguraDaListaDeCriterios:
        document.querySelector('.desempate-list')?.getBoundingClientRect().width ?? 0,
    };
  });
}

/** O código da regra escolhida, medido na fonte do seletor, tem de caber no espaço de texto dele. */
async function codigoCabeNoSeletor(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const seletor = document.querySelector('.desempate-item')?.querySelector('select');
    const contexto = document.createElement('canvas').getContext('2d');
    if (!(seletor instanceof HTMLSelectElement) || !contexto) return false;

    const escolhida = seletor.selectedOptions[0]?.textContent?.split('—')[0]?.trim() ?? '';
    const estilo = getComputedStyle(seletor);
    contexto.font = `${estilo.fontWeight} ${estilo.fontSize} ${estilo.fontFamily}`;
    const padding = parseFloat(estilo.paddingLeft) + parseFloat(estilo.paddingRight);
    return contexto.measureText(escolhida).width <= seletor.clientWidth - padding;
  });
}

/** Onde ficam número, campos e ações do cartão uns em relação aos outros. */
async function alinhamentoDoCartao(
  page: Page,
): Promise<Pick<MedidasDoCartao, 'camposAbaixoDoNumero' | 'desalinhamentoNoTopo'>> {
  return page.evaluate(() => {
    const cartao = document.querySelector('.desempate-item');
    const caixa = (seletor: string) => cartao?.querySelector(seletor)?.getBoundingClientRect();
    const numero = caixa('.desempate-num');
    const campos = caixa('.desempate-item__campos');
    // A maior distância entre os topos de número, campos e ações.
    const topos = [numero, campos, caixa(':scope > .desempate-actions')]
      .filter((medida) => medida !== undefined)
      .map((medida) => medida.top);
    return {
      desalinhamentoNoTopo: topos.length === 0 ? Infinity : Math.max(...topos) - Math.min(...topos),
      camposAbaixoDoNumero: !!numero && !!campos && campos.top >= numero.bottom,
    };
  });
}
