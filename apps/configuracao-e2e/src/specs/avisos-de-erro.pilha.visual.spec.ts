import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  abrirListaQueFalha,
  dispararAvisos,
  DISPAROS_POR_CODIGO,
  TOTAL_DE_AVISOS_DISTINTOS,
  TOTAL_DE_DISPAROS,
  type Janela,
} from '../support/avisos-de-erro-fixos';

/** 640×360 equivale a 1280×720 com zoom de 200%; as duas janelas são telas compactas (1 aviso à vista). */
const JANELAS: readonly Janela[] = [
  { nome: '320×568', width: 320, height: 568 },
  { nome: '640×360 (1280×720 a 200%)', width: 640, height: 360 },
];
const JANELA_NORMAL: Janela = { nome: '1280×800', width: 1280, height: 800 };
const AVISOS_A_VISTA_NA_TELA_COMPACTA = 1;
const LIMITE_DE_TABS = 12;
const DISPAROS_COM_DEZENAS_DE_ANTERIORES = 100;

const pilha = (page: Page): Locator => page.locator('.toast-stack');
const cartoesAVista = (page: Page): Locator => page.locator('.toast-region ui-aviso');
const maisAvisos = (page: Page): Locator => page.getByTestId('notification-host-mais');
const fechar = (page: Page): Locator =>
  page.locator('.toast-region').getByTestId('notification-host-dismiss');

interface MedidasDaPilha {
  readonly alturaDaTela: number;
  readonly alturaDaPilha: number;
  readonly alturaDoCartaoMaisNovo: number;
  readonly recuoVertical: number;
  readonly rolagemHorizontal: boolean;
}

function medirAPilha(page: Page): Promise<MedidasDaPilha> {
  return page.evaluate(() => {
    const regiao = document.querySelector<HTMLElement>('.toast-stack');
    const cartao = document.querySelector<HTMLElement>('.toast-region ui-aviso .toast');
    if (!regiao || !cartao) throw new Error('A pilha de avisos não está na tela.');
    const estilo = getComputedStyle(regiao);
    return {
      alturaDaTela: window.innerHeight,
      alturaDaPilha: regiao.getBoundingClientRect().height,
      alturaDoCartaoMaisNovo: cartao.getBoundingClientRect().height,
      recuoVertical: parseFloat(estilo.paddingTop) + parseFloat(estilo.paddingBottom),
      rolagemHorizontal:
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
}

async function esperarCartaoMaisNovoDentroDaTela(page: Page): Promise<void> {
  const tela = page.viewportSize();
  if (!tela) throw new Error('A janela não tem tamanho definido.');
  const cartao = cartoesAVista(page).last().locator('.toast');
  await expect(cartao).toBeVisible();
  await expect
    .poll(async () => {
      const caixa = await cartao.boundingBox();
      if (!caixa) return false;
      return (
        caixa.x >= 0 &&
        caixa.y >= 0 &&
        caixa.x + caixa.width <= tela.width &&
        caixa.y + caixa.height <= tela.height
      );
    })
    .toBe(true);
}

/** Volta pelo teclado a partir do fim da página e anota o que recebeu o foco (`data-testid`, ou a classe). */
async function percorrerComShiftTab(page: Page): Promise<string[]> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const recebeuFoco: string[] = [];
  for (let i = 0; i < LIMITE_DE_TABS; i += 1) {
    await page.keyboard.press('Shift+Tab');
    recebeuFoco.push(
      await page.evaluate(() => {
        const atual = document.activeElement;
        return atual?.getAttribute('data-testid') ?? atual?.className ?? '';
      }),
    );
  }
  return recebeuFoco;
}

const focoNosAvisosOuNoPrincipal = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const atual = document.activeElement;
    if (!atual || atual === document.body) return false;
    return atual.closest('.toast-stack') !== null || atual.closest('main') !== null;
  });

for (const janela of JANELAS) {
  test.describe(`Avisos de erro fixos repetidos, janela ${janela.nome}`, () => {
    test('altura: a pilha ocupa até 50% da tela (ou só o aviso mais novo, inteiro) e nada rola na horizontal', async ({
      page,
    }, testInfo) => {
      const lista = await abrirListaQueFalha(page, testInfo, janela);
      await dispararAvisos(page, lista, TOTAL_DE_DISPAROS);

      const medidas = await medirAPilha(page);

      const cabeNaMetade = medidas.alturaDaPilha <= medidas.alturaDaTela * 0.5 + 1;
      const soOCartaoMaisNovoPassa =
        medidas.alturaDoCartaoMaisNovo + medidas.recuoVertical > medidas.alturaDaTela * 0.5;
      expect(cabeNaMetade || soOCartaoMaisNovoPassa).toBe(true);
      expect(medidas.rolagemHorizontal).toBe(false);
    });

    test('aviso mais novo: fica inteiro dentro da tela logo depois de disparado, sem rolar a região', async ({
      page,
    }, testInfo) => {
      const lista = await abrirListaQueFalha(page, testInfo, janela);

      await dispararAvisos(page, lista, TOTAL_DE_DISPAROS, () =>
        esperarCartaoMaisNovoDentroDaTela(page),
      );

      expect(await pilha(page).evaluate((el) => el.scrollTop)).toBe(0);
    });

    test('alcance: o Fechar do aviso à vista e o "Mais N avisos" aparecem e recebem o foco por Tab', async ({
      page,
    }, testInfo) => {
      const lista = await abrirListaQueFalha(page, testInfo, janela);
      await dispararAvisos(page, lista, TOTAL_DE_DISPAROS);

      await expect(fechar(page)).toBeInViewport({ ratio: 1 });
      await expect(maisAvisos(page)).toBeInViewport({ ratio: 1 });
      const recebeuFoco = await percorrerComShiftTab(page);

      expect(recebeuFoco).toContain('notification-host-dismiss');
      expect(recebeuFoco).toContain('notification-host-mais');
    });

    test('repetidos: avisos iguais se agrupam e mostram a contagem, sem multiplicar cartões', async ({
      page,
    }, testInfo) => {
      const lista = await abrirListaQueFalha(page, testInfo, janela);

      await dispararAvisos(page, lista, TOTAL_DE_DISPAROS);

      await expect(cartoesAVista(page)).toHaveCount(AVISOS_A_VISTA_NA_TELA_COMPACTA);
      await expect(page.getByTestId('notification-host-contagem')).toHaveText(
        `Ocorreu ${DISPAROS_POR_CODIGO} vezes`,
      );
      await expect(maisAvisos(page)).toHaveText(
        `Mais ${TOTAL_DE_AVISOS_DISTINTOS - AVISOS_A_VISTA_NA_TELA_COMPACTA} avisos`,
      );
    });

    test('foco: fechar um aviso só pelo teclado deixa o foco nos avisos ou no conteúdo principal', async ({
      page,
    }, testInfo) => {
      const lista = await abrirListaQueFalha(page, testInfo, janela);
      await dispararAvisos(page, lista, TOTAL_DE_DISPAROS);

      await fechar(page).focus();
      await page.keyboard.press('Enter');

      await expect.poll(() => focoNosAvisosOuNoPrincipal(page)).toBe(true);
    });
  });
}

test.describe(`Avisos de erro fixos com detalhe e referência, janela ${JANELA_NORMAL.nome}`, () => {
  test('altura: a região dos avisos fica em até 50% da tela e o aviso mais novo, dentro dela', async ({
    page,
  }, testInfo) => {
    const lista = await abrirListaQueFalha(page, testInfo, JANELA_NORMAL);
    await dispararAvisos(page, lista, TOTAL_DE_DISPAROS, () =>
      esperarCartaoMaisNovoDentroDaTela(page),
    );

    const regiao = page.locator('.toast-region');
    await expect
      .poll(async () => (await regiao.boundingBox())?.height ?? Number.POSITIVE_INFINITY)
      .toBeLessThanOrEqual(JANELA_NORMAL.height * 0.5 + 1);
    await esperarCartaoMaisNovoDentroDaTela(page);
    expect(await pilha(page).evaluate((el) => el.scrollTop)).toBe(0);
  });
});

test.describe(`Identificadores anteriores abertos, janela ${JANELA_NORMAL.nome}`, () => {
  test('o cartão mais novo continua com o Fechar dentro da tela', async ({ page }, testInfo) => {
    const lista = await abrirListaQueFalha(page, testInfo, JANELA_NORMAL);
    await dispararAvisos(page, lista, DISPAROS_COM_DEZENAS_DE_ANTERIORES);

    await cartoesAVista(page).last().locator('details > summary').click();

    await expect(fechar(page).last()).toBeInViewport({ ratio: 1 });
  });
});
